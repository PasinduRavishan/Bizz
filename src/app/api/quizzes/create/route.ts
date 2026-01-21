import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { generateSalt, hashAnswers, encryptQuizRevealData } from '@/lib/crypto'
import { uploadQuestionsToIPFS } from '@/lib/ipfs'
import { prisma } from '@/lib/prisma'
import { getUserWallet } from '@/lib/wallet-service'
import { ensureWalletHasUTXOs } from '@/lib/wallet-funding'

export const runtime = 'nodejs'

interface QuizQuestion {
  question: string
  options: string[]
  correctAnswer: number
}

interface CreateQuizRequest {
  questions: QuizQuestion[]
  prizePool: number
  entryFee: number
  passThreshold: number
  deadline: string
  title?: string
  description?: string
  teacherPublicKey?: string
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (session.user.role !== 'TEACHER') {
      return NextResponse.json(
        { success: false, error: 'Only teachers can create quizzes' },
        { status: 403 }
      )
    }

    const body: CreateQuizRequest = await request.json()

    if (!body.questions || body.questions.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one question is required' },
        { status: 400 }
      )
    }

    if (body.prizePool < 10000) {
      return NextResponse.json(
        { success: false, error: 'Prize pool must be at least 10,000 satoshis' },
        { status: 400 }
      )
    }

    if (body.entryFee < 5000) {
      return NextResponse.json(
        { success: false, error: 'Entry fee must be at least 5,000 satoshis' },
        { status: 400 }
      )
    }

    if (body.passThreshold < 0 || body.passThreshold > 100) {
      return NextResponse.json(
        { success: false, error: 'Pass threshold must be between 0 and 100' },
        { status: 400 }
      )
    }

    const deadline = new Date(body.deadline)
    if (deadline <= new Date()) {
      return NextResponse.json(
        { success: false, error: 'Deadline must be in the future' },
        { status: 400 }
      )
    }

    // @ts-expect-error - Bitcoin Computer lib doesn't have type definitions
    await import('@bitcoin-computer/lib')

    console.log('🔑 Getting teacher custodial wallet...')
    const computer = await getUserWallet(session.user.id)
    const teacherPublicKey = computer.getPublicKey()

    console.log('🚀 Teacher wallet address:', computer.getAddress())
    console.log('🚀 Creating quiz contract...')
    console.log('  Teacher ID:', session.user.id)
    console.log('  Teacher Public Key:', teacherPublicKey.substring(0, 20) + '...')
    console.log('  Questions:', body.questions.length)
    console.log('  Prize Pool:', body.prizePool, 'sats')
    console.log('  Entry Fee:', body.entryFee, 'sats')

    const salt = generateSalt()
    const tempQuizId = `quiz-${Date.now()}-${Math.random().toString(36).substring(7)}`
    const correctAnswers = body.questions.map((q) => q.options[q.correctAnswer])
    const answerHashes = hashAnswers(tempQuizId, correctAnswers, salt)

    const questionsForIPFS = body.questions.map((q) => ({
      question: q.question,
      options: q.options
    }))

    const questionHashIPFS = await uploadQuestionsToIPFS(questionsForIPFS)

    // ✅ UPDATED: Payment class MUST be in the same module as Quiz
    // This allows Quiz.distributePrizes() to create Payment contracts FROM Quiz's satoshis
    const QuizContract = `
      export class Payment extends Contract {
        constructor(recipient, amount, purpose, reference) {
          if (!recipient) throw new Error('Recipient required')
          if (amount < 546n) throw new Error('Amount must be at least 546 satoshis')
          if (!purpose) throw new Error('Purpose required')

          super({
            _owners: [recipient],
            _satoshis: amount,
            recipient,
            amount,
            purpose,
            reference,
            status: 'unclaimed',
            createdAt: Date.now(),
            claimedAt: null
          })
        }

        claim() {
          if (this.status === 'claimed') {
            throw new Error('Payment already claimed')
          }
          this._satoshis = 546n
          this.status = 'claimed'
          this.claimedAt = Date.now()
        }

        getInfo() {
          return {
            paymentId: this._id,
            recipient: this.recipient,
            amount: this.amount,
            purpose: this.purpose,
            reference: this.reference,
            status: this.status,
            createdAt: this.createdAt,
            claimedAt: this.claimedAt,
            canClaim: this.status === 'unclaimed'
          }
        }
      }

      export class Quiz extends Contract {
        constructor(teacher, questionHashIPFS, answerHashes, prizePool, entryFee, passThreshold, deadline, teacherRevealDeadline) {
          if (!teacher) throw new Error('Teacher public key required')
          if (!questionHashIPFS) throw new Error('Question hash required')
          if (!Array.isArray(answerHashes) || answerHashes.length === 0) {
            throw new Error('Answer hashes must be a non-empty array')
          }
          if (prizePool < 10000n) {
            throw new Error('Prize pool must be at least 10,000 satoshis')
          }
          if (entryFee < 5000n) {
            throw new Error('Entry fee must be at least 5,000 satoshis')
          }
          if (passThreshold < 0 || passThreshold > 100) {
            throw new Error('Pass threshold must be between 0 and 100')
          }

          super({
            _owners: [teacher],
            _satoshis: prizePool,
            teacher: teacher,
            questionHashIPFS: questionHashIPFS,
            answerHashes: answerHashes,
            questionCount: answerHashes.length,
            entryFee: entryFee,
            prizePool: prizePool,
            passThreshold: passThreshold,
            platformFee: 0.02,
            deadline: deadline,
            teacherRevealDeadline: teacherRevealDeadline,
            status: 'active',
            revealedAnswers: null,
            salt: null,
            winners: [],
            createdAt: Date.now(),
            version: '1.0.0'
          })
        }

        revealAnswers(answers, salt) {
          if (!this._owners.includes(this.teacher)) {
            throw new Error('Only teacher can reveal answers')
          }
          if (Date.now() < this.deadline) {
            throw new Error('Quiz is still active')
          }
          if (Date.now() > this.teacherRevealDeadline) {
            throw new Error('Teacher reveal deadline has passed')
          }
          if (this.status !== 'active') {
            throw new Error('Quiz is not in active status')
          }
          if (answers.length !== this.answerHashes.length) {
            throw new Error('Answer count does not match')
          }
          this.revealedAnswers = answers
          this.salt = salt
          this.status = 'revealed'
        }

        async distributePrizes(winners) {
          if (this.status !== 'revealed') {
            throw new Error('Quiz must be revealed first')
          }
          if (!this._owners.includes(this.teacher)) {
            throw new Error('Only teacher can distribute prizes')
          }
          if (!Array.isArray(winners) || winners.length === 0) {
            this.status = 'completed'
            return []
          }

          // Payment class is in the same module, no need to import
          const payments = []
          let totalDistributed = BigInt(0)

          // Calculate prize per winner
          const totalPrize = this._satoshis - BigInt(546)
          const prizePerWinner = totalPrize / BigInt(winners.length)

          // Create Payment contracts using Quiz's satoshis
          for (const winner of winners) {
            const payment = new Payment(
              winner.student,
              prizePerWinner,
              \`Quiz Prize - \${this.questionHashIPFS}\`,
              this._id
            )
            payments.push(payment._rev)
            totalDistributed += prizePerWinner
          }

          // Reduce Quiz satoshis by distributed amount
          this._satoshis = this._satoshis - totalDistributed
          this.winners = winners.map((w, i) => ({
            ...w,
            prizeAmount: prizePerWinner.toString(),
            paymentRev: payments[i]
          }))
          this.status = 'completed'

          return payments
        }

        markDistributionComplete() {
          if (this.status !== 'distributing') {
            throw new Error('Quiz must be in distributing status')
          }
          this.status = 'completed'
        }

        complete(winners) {
          if (this.status !== 'revealed') {
            throw new Error('Quiz must be revealed first')
          }
          this.winners = winners
          this.status = 'completed'
        }

        triggerRefund() {
          if (this.status !== 'active') {
            throw new Error('Quiz is not in active status')
          }
          if (Date.now() <= this.teacherRevealDeadline) {
            throw new Error('Teacher still has time to reveal')
          }
          this.status = 'refunded'
        }

        getInfo() {
          return {
            quizId: this._id,
            quizRev: this._rev,
            teacher: this.teacher,
            questionHashIPFS: this.questionHashIPFS,
            questionCount: this.questionCount,
            entryFee: this.entryFee,
            prizePool: this._satoshis,
            passThreshold: this.passThreshold,
            deadline: this.deadline,
            teacherRevealDeadline: this.teacherRevealDeadline,
            status: this.status,
            createdAt: this.createdAt
          }
        }
      }
    `

    console.log('💰 Ensuring wallet has spendable UTXOs...')
    try {
      const { balance } = await computer.getBalance()
      const hasBalance = balance > BigInt(body.prizePool + 50000)
      
      await ensureWalletHasUTXOs(
        session.user.id, 
        100000,
        hasBalance
      )
    } catch (fundingError) {
      console.error('❌ Wallet funding check failed:', fundingError)
      return NextResponse.json(
        { 
          success: false, 
          error: fundingError instanceof Error ? fundingError.message : 'Failed to ensure wallet has funds',
          hint: 'Your wallet has balance but all funds are locked in existing contracts. Please send fresh coins from an external wallet to create new contracts.'
        },
        { status: 400 }
      )
    }

    console.log('📦 Deploying Quiz contract module...')

    // Helper function for mempool retry
    async function withMempoolRetry<T>(
      operation: () => Promise<T>,
      operationName: string,
      maxRetries: number = 5
    ): Promise<T> {
      let lastError: Error | null = null

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          return await operation()
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error))
          const isMempoolConflict = lastError.message.includes('txn-mempool-conflict')
          const isTooLongChain = lastError.message.includes('too-long-mempool-chain')

          // Special handling for too-long-mempool-chain - needs longer waits
          if (isTooLongChain) {
            if (attempt === maxRetries) {
              console.error(`\n⚠️  MEMPOOL ANCESTOR LIMIT REACHED`)
              console.error(`Bitcoin allows maximum 25 unconfirmed transactions in a chain.`)
              console.error(`You have too many pending transactions. Solutions:`)
              console.error(`  1. Wait 10-20 minutes for blockchain confirmations`)
              console.error(`  2. Check mempool.space for your address to see pending txs`)
              console.error(`  3. Avoid rapid transaction creation (wait between operations)`)
              throw new Error(`Mempool ancestor limit (25) exceeded. Please wait 10-20 minutes for pending transactions to confirm before creating new contracts.`)
            }
            
            // Longer delays for ancestor chain issues (15s, 30s, 60s, 120s, 240s)
            const delayMs = 15000 * Math.pow(2, attempt - 1)
            console.log(`  ⏳ ${operationName}: TOO MANY UNCONFIRMED ANCESTORS, waiting ${delayMs/1000}s for blockchain confirmations... (${attempt}/${maxRetries})`)
            await new Promise(resolve => setTimeout(resolve, delayMs))
            continue
          }

          if (isMempoolConflict) {
            if (attempt === maxRetries) {
              throw lastError
            }
            
            // Standard mempool conflict delays (3s, 6s, 12s, 24s, 48s)
            const delayMs = 3000 * Math.pow(2, attempt - 1)
            console.log(`  ⏳ ${operationName}: mempool conflict, waiting ${delayMs/1000}s before retry ${attempt + 1}/${maxRetries}...`)
            await new Promise(resolve => setTimeout(resolve, delayMs))
            continue
          }

          // Not a mempool issue - throw immediately
          throw lastError
        }
      }

      throw lastError
    }

    const moduleSpecifier = await withMempoolRetry(
      () => computer.deploy(QuizContract),
      'Deploy Quiz module',
      5
    )
    console.log('✅ Module deployed:', moduleSpecifier)

    console.log('🎓 Creating quiz instance from module...')

    // Calculate teacher reveal deadline
    const TEACHER_REVEAL_WINDOW = parseInt(process.env.TEACHER_REVEAL_WINDOW_MINUTES || '5') * 60 * 1000
    const teacherRevealDeadline = deadline.getTime() + TEACHER_REVEAL_WINDOW

    const encodeResult = await withMempoolRetry(
      () => computer.encode({
        mod: moduleSpecifier,
        exp: `new Quiz("${teacherPublicKey}", "${questionHashIPFS}", ${JSON.stringify(answerHashes)}, BigInt(${body.prizePool}), BigInt(${body.entryFee}), ${body.passThreshold}, ${deadline.getTime()}, ${teacherRevealDeadline})`
      }),
      'Create Quiz instance',
      5
    )
    const { tx, effect } = encodeResult as { tx: any, effect: any }

    const txId = await withMempoolRetry(
      () => computer.broadcast(tx),
      'Broadcast Quiz creation',
      5
    )
    const quiz = effect.res as { _id: string; _rev: string }

    console.log('✅ Quiz created!')
    console.log('  Contract ID:', quiz._id)
    console.log('  Contract Rev:', quiz._rev)
    console.log('  TX ID:', txId)

    try {
      const teacher = await prisma.user.findUnique({
        where: { id: session.user.id }
      })

      if (!teacher) {
        throw new Error('Teacher user not found')
      }

      if (!teacher.publicKey) {
        await prisma.user.update({
          where: { id: teacher.id },
          data: {
            publicKey: teacherPublicKey,
            address: computer.getAddress()
          }
        })
        console.log('👤 Updated teacher wallet info')
      }

      const TEACHER_REVEAL_WINDOW = parseInt(process.env.TEACHER_REVEAL_WINDOW_MINUTES || '5') * 60 * 1000

      const questionsForDB = body.questions.map((q) => ({
        question: q.question,
        options: q.options
      }))

      const REVEAL_DATA_KEY = process.env.REVEAL_DATA_KEY || process.env.WALLET_ENCRYPTION_KEY
      if (!REVEAL_DATA_KEY) {
        throw new Error('REVEAL_DATA_KEY environment variable is required')
      }

      const encryptedRevealData = encryptQuizRevealData(
        { answers: correctAnswers, salt: salt },
        REVEAL_DATA_KEY
      )

      const createdQuiz = await prisma.quiz.create({
        data: {
          contractId: quiz._id,
          contractRev: quiz._rev,
          teacherId: session.user.id,
          title: body.title || null,
          questions: questionsForDB,
          questionHashIPFS: questionHashIPFS,
          answerHashes: answerHashes,
          hashingQuizId: tempQuizId,
          questionCount: body.questions.length,
          prizePool: BigInt(body.prizePool),
          entryFee: BigInt(body.entryFee),
          passThreshold: body.passThreshold,
          platformFee: 0.02,
          deadline: deadline,
          teacherRevealDeadline: new Date(deadline.getTime() + TEACHER_REVEAL_WINDOW),
          status: 'ACTIVE',
          salt: salt,
          encryptedRevealData: encryptedRevealData
        }
      })
      console.log('💾 Quiz saved to database with questions')
      console.log('  Database ID:', createdQuiz.id)
    } catch (dbError) {
      console.error('⚠️ Failed to save to database (indexer will catch it):', dbError)
    }

    return NextResponse.json({
      success: true,
      quizId: quiz._id,
      quizRev: quiz._rev,
      salt: salt,
      correctAnswers: correctAnswers
    })

  } catch (error) {
    console.error('❌ Failed to create quiz:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create quiz'
      },
      { status: 500 }
    )
  }
}