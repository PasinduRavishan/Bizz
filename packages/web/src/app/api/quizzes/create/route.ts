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

    // Minimal Quiz contract - optimized for size limits
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
          if (this.status === 'claimed') throw new Error('Payment already claimed')
          this._satoshis = 546n
          this.status = 'claimed'
          this.claimedAt = Date.now()
        }
      }

      export class Quiz extends Contract {
        constructor(t, q, h, p, e, th, d, s, r, dist) {
          if (!t) throw new Error('Teacher required')
          if (!q) throw new Error('Question hash required')
          if (!Array.isArray(h) || h.length === 0) throw new Error('Answer hashes required')
          if (p < 10000n) throw new Error('Prize pool too low')
          if (e < 5000n) throw new Error('Entry fee too low')

          super({
            _owners: [t],
            _satoshis: 546n,
            teacher: t,
            questionHashIPFS: q,
            answerHashes: h,
            questionCount: h.length,
            entryFee: e,
            prizePool: p,
            passThreshold: th,
            deadline: d,
            studentRevealDeadline: s,
            teacherRevealDeadline: r,
            distributionDeadline: dist,
            status: 'active',
            revealedAnswers: null,
            salt: null
          })
        }

        revealAnswers(a, s) {
          if (!this._owners.includes(this.teacher)) throw new Error('Unauthorized')
          if (Date.now() < this.deadline) throw new Error('Too early')
          if (Date.now() > this.teacherRevealDeadline) throw new Error('Too late')
          if (this.status !== 'active') throw new Error('Invalid status')
          this.revealedAnswers = a
          this.salt = s
          this.status = 'revealed'
        }

        distributePrizes() {
          if (this.status !== 'revealed') throw new Error('Not revealed')
          if (!this._owners.includes(this.teacher)) throw new Error('Unauthorized')
          if (Date.now() > this.distributionDeadline) throw new Error('Deadline passed')
          this.status = 'completed'
        }

        markAbandoned() {
          const missed = (this.status === 'active' && Date.now() > this.teacherRevealDeadline) ||
                        (this.status === 'revealed' && Date.now() > this.distributionDeadline)
          if (!missed) throw new Error('Cannot abandon')
          this.status = 'abandoned'
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

          if (isTooLongChain) {
            // On regtest, use faucet to mine blocks and confirm transactions
            const isRegtest = process.env.BITCOIN_NETWORK === 'regtest'

            if (isRegtest) {
              console.log(`  ⛏️  ${operationName}: Mining blocks on regtest to confirm transactions... (attempt ${attempt}/${maxRetries})`)
              try {
                // Fund with faucet - this mines blocks and confirms pending transactions
                await computer.faucet(0.01e8) // Small amount, mainly to mine blocks
                console.log(`  ✅ Blocks mined, transactions confirmed`)
                // Small delay to let blockchain sync
                await new Promise(resolve => setTimeout(resolve, 2000))
                continue
              } catch (faucetError) {
                console.error(`  ⚠️  Faucet failed:`, faucetError)
                // Fall through to regular delay logic
              }
            }

            if (attempt === maxRetries) {
              console.error(`\n⚠️  MEMPOOL ANCESTOR LIMIT REACHED`)
              console.error(`Bitcoin allows maximum 25 unconfirmed transactions in a chain.`)
              console.error(`You have too many pending transactions. Solutions:`)
              console.error(`  1. Wait 10-20 minutes for blockchain confirmations`)
              console.error(`  2. Check mempool.space for your address to see pending txs`)
              console.error(`  3. Avoid rapid transaction creation (wait between operations)`)
              if (isRegtest) {
                console.error(`  4. On regtest: faucet mining failed, try restarting Bitcoin node`)
              }
              throw new Error(`Mempool ancestor limit (25) exceeded. Please wait 10-20 minutes for pending transactions to confirm before creating new contracts.`)
            }

            const delayMs = 15000 * Math.pow(2, attempt - 1)
            console.log(`  ⏳ ${operationName}: TOO MANY UNCONFIRMED ANCESTORS, waiting ${delayMs/1000}s for blockchain confirmations... (${attempt}/${maxRetries})`)
            await new Promise(resolve => setTimeout(resolve, delayMs))
            continue
          }

          if (isMempoolConflict) {
            if (attempt === maxRetries) {
              throw lastError
            }

            const delayMs = 3000 * Math.pow(2, attempt - 1)
            console.log(`  ⏳ ${operationName}: mempool conflict, waiting ${delayMs/1000}s before retry ${attempt + 1}/${maxRetries}...`)
            await new Promise(resolve => setTimeout(resolve, delayMs))
            continue
          }

          throw lastError
        }
      }

      throw lastError
    }

    console.log('📦 Deploying Quiz contract module...')

    // Deploy contract class definition once (this will be reused for all quiz instances)
    const moduleSpecifier = await withMempoolRetry(
      () => computer.deploy(QuizContract),
      'Deploy Quiz module',
      5
    )
    console.log('✅ Module deployed:', moduleSpecifier)

    console.log('📥 Loading Quiz class from deployed module...')
    const { Quiz } = await computer.load(moduleSpecifier)

    console.log('🎓 Creating quiz instance from module...')

    // Calculate all deadlines from environment variables
    const STUDENT_REVEAL_WINDOW = parseInt(process.env.NEXT_PUBLIC_STUDENT_REVEAL_WINDOW_MS || '300000')
    const TEACHER_REVEAL_WINDOW = parseInt(process.env.NEXT_PUBLIC_TEACHER_REVEAL_WINDOW_MS || '300000')
    const DISTRIBUTION_DEADLINE_HOURS = parseInt(process.env.NEXT_PUBLIC_DISTRIBUTION_DEADLINE_HOURS || '24')

    const studentRevealDeadline = deadline.getTime() + STUDENT_REVEAL_WINDOW
    const teacherRevealDeadline = studentRevealDeadline + TEACHER_REVEAL_WINDOW
    const distributionDeadline = teacherRevealDeadline + (DISTRIBUTION_DEADLINE_HOURS * 60 * 60 * 1000)

    // Create quiz instance using the loaded Quiz class and module specifier
    const quiz = await withMempoolRetry(
      () => computer.new(
        Quiz,
        [
          teacherPublicKey,
          questionHashIPFS,
          answerHashes,
          BigInt(body.prizePool),
          BigInt(body.entryFee),
          body.passThreshold,
          deadline.getTime(),
          studentRevealDeadline,
          teacherRevealDeadline,
          distributionDeadline
        ],
        moduleSpecifier
      ),
      'Create Quiz instance',
      5
    ) as { _id: string; _rev: string }

    console.log('✅ Quiz created!')
    console.log('  Contract ID:', quiz._id)
    console.log('  Contract Rev:', quiz._rev)

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
          moduleSpecifier: moduleSpecifier as string,
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
          studentRevealDeadline: new Date(studentRevealDeadline),
          teacherRevealDeadline: new Date(teacherRevealDeadline),
          distributionDeadline: new Date(distributionDeadline),
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