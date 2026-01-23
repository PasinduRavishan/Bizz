import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hashCommitment, generateNonce, encryptAttemptRevealData } from '@/lib/crypto'
import { prisma } from '@/lib/prisma'
import { getUserWallet } from '@/lib/wallet-service'
import { ensureWalletHasUTXOs } from '@/lib/wallet-funding'

export const runtime = 'nodejs'

interface SubmitAttemptRequest {
  studentPublicKey?: string // Optional - from wallet if connected
  quizContractId: string
  quizContractRev: string
  answers: string[]
  entryFee: number
}

/**
 * POST /api/attempts/submit
 *
 * Creates a new quiz attempt by deploying a QuizAttempt contract to the blockchain.
 * Uses the server's Bitcoin Computer instance with shared mnemonic.
 * Follows the same deploy() + encode() pattern as quiz creation.
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (session.user.role !== 'STUDENT') {
      return NextResponse.json(
        { success: false, error: 'Only students can submit quiz attempts' },
        { status: 403 }
      )
    }

    const body: SubmitAttemptRequest = await request.json()

    // Validation
    if (!body.quizContractRev && !body.quizContractId) {
      return NextResponse.json(
        { success: false, error: 'Quiz contract ID or revision is required' },
        { status: 400 }
      )
    }

    if (!body.answers || body.answers.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Answers are required' },
        { status: 400 }
      )
    }

    if (body.entryFee < 5000) {
      return NextResponse.json(
        { success: false, error: 'Entry fee must be at least 5,000 satoshis' },
        { status: 400 }
      )
    }

    // Check if quiz exists and get deadline + teacher info
    const quizRecord = await prisma.quiz.findFirst({
      where: {
        OR: [
          { contractRev: body.quizContractRev },
          { contractId: body.quizContractId }
        ]
      },
      select: {
        id: true,
        deadline: true,
        status: true,
        questionCount: true,
        teacher: {
          select: {
            publicKey: true
          }
        }
      }
    })

    if (!quizRecord) {
      return NextResponse.json(
        { success: false, error: 'Quiz not found' },
        { status: 404 }
      )
    }

    // CRITICAL: Enforce deadline - students cannot attempt after deadline
    const now = new Date()
    if (now >= quizRecord.deadline) {
      return NextResponse.json(
        { success: false, error: 'Quiz deadline has passed. You can no longer submit attempts.' },
        { status: 400 }
      )
    }

    // Validate quiz is active
    if (quizRecord.status !== 'ACTIVE') {
      return NextResponse.json(
        { success: false, error: `Quiz is not accepting attempts (status: ${quizRecord.status})` },
        { status: 400 }
      )
    }

    // Validate answer count
    if (body.answers.length !== quizRecord.questionCount) {
      return NextResponse.json(
        { success: false, error: `Expected ${quizRecord.questionCount} answers, got ${body.answers.length}` },
        { status: 400 }
      )
    }

    console.log('📝 Deploying QuizAttempt contract from API route...')
    console.log('📋 Attempt Details:')
    console.log('  Student ID:', session.user.id)
    console.log('  Quiz Rev:', body.quizContractRev.substring(0, 20) + '...')
    console.log('  Answers:', body.answers.length)
    console.log('  Entry Fee:', body.entryFee, 'sats')

    // Generate nonce and commitment hash
    const nonce = generateNonce()
    const answerCommitment = hashCommitment(body.answers, nonce)

    console.log('🔐 Commitment hash:', answerCommitment.substring(0, 20) + '...')

    // @ts-expect-error - Bitcoin Computer lib doesn't have type definitions
    await import('@bitcoin-computer/lib')

    // Get student's custodial wallet
    console.log('🔑 Getting student custodial wallet...')
    const computer = await getUserWallet(session.user.id)
    const studentPublicKey = computer.getPublicKey()

    console.log('🔑 Student wallet address:', computer.getAddress())

    // Check balance
    const { balance } = await computer.getBalance()
    console.log('💰 Student wallet balance:', balance.toString(), 'sats')

    const requiredBalance = body.entryFee + 200000 // Entry fee + gas
    if (balance < BigInt(requiredBalance)) {
      return NextResponse.json(
        { success: false, error: `Insufficient balance. Need ${requiredBalance} sats, have ${balance} sats. Please contact support to add funds.` },
        { status: 400 }
      )
    }

    // Ensure wallet has spendable UTXOs
    console.log('💰 Ensuring wallet has spendable UTXOs...')
    try {
      const hasBalance = balance > BigInt(requiredBalance)

      await ensureWalletHasUTXOs(
        session.user.id,
        100000, // Minimum UTXO size
        hasBalance // Skip check if balance is sufficient (will use contract funds)
      )
    } catch (fundingError) {
      console.error('❌ Wallet funding check failed:', fundingError)
      return NextResponse.json(
        {
          success: false,
          error: fundingError instanceof Error ? fundingError.message : 'Failed to ensure wallet has funds',
          details: 'Your wallet needs spendable Bitcoin to submit attempts. Please contact support.'
        },
        { status: 500 }
      )
    }

    // Define QuizAttempt contract inline (pure JavaScript, no imports)
    // Following the same pattern as Quiz contract deployment
    const QuizAttemptContract = `
      export class QuizAttempt extends Contract {
        constructor(student, quizRef, answerCommitment, entryFee, quizTeacher) {
          if (!student) throw new Error('Student public key required')
          if (!quizRef) throw new Error('Quiz reference required')
          if (!answerCommitment) throw new Error('Answer commitment required')
          if (entryFee < 5000n) {
            throw new Error('Entry fee must be at least 5,000 satoshis')
          }

          super({
            _owners: [student],
            _satoshis: entryFee,
            student: student,
            quizRef: quizRef,
            quizTeacher: quizTeacher,
            answerCommitment: answerCommitment,
            revealedAnswers: null,
            nonce: null,
            score: null,
            passed: null,
            status: 'committed',
            submitTimestamp: Date.now(),
            revealTimestamp: null,
            version: '1.1.0'
          })
        }

        reveal(answers, nonce) {
          if (this.status !== 'committed') {
            throw new Error('Attempt already revealed or verified')
          }
          if (!Array.isArray(answers) || answers.length === 0) {
            throw new Error('Answers must be a non-empty array')
          }
          if (!nonce) {
            throw new Error('Nonce is required')
          }
          this.revealedAnswers = answers
          this.nonce = nonce
          this.status = 'revealed'
          this.revealTimestamp = Date.now()
        }

        verify(score, passed) {
          if (this.status !== 'revealed') {
            throw new Error('Must reveal answers first')
          }
          this.score = score
          this.passed = passed
          this.status = 'verified'
        }

        fail() {
          this.status = 'failed'
          this.passed = false
        }

        claimRefund(quiz) {
          // Validate quiz reference
          if (this.quizRef !== quiz._id) {
            throw new Error('Quiz reference mismatch')
          }

          if (this.status === 'refunded') {
            throw new Error('Refund already claimed')
          }

          // Scenario 1: Teacher didn't reveal before deadline
          const teacherMissedReveal = (
            quiz.status === 'active' &&
            Date.now() > quiz.teacherRevealDeadline
          )

          // Scenario 2: Teacher revealed but didn't distribute
          const teacherAbandonedAfterReveal = (
            quiz.status === 'revealed' &&
            Date.now() > quiz.distributionDeadline
          )

          // Scenario 3: Quiz explicitly marked abandoned
          const quizAbandoned = (quiz.status === 'abandoned')

          if (!teacherMissedReveal && !teacherAbandonedAfterReveal && !quizAbandoned) {
            throw new Error('Cannot claim refund: quiz not abandoned')
          }

          // Cash out entry fee to student
          this._satoshis = 546n
          this.status = 'refunded'
          this.refundedAt = Date.now()
        }

        getInfo() {
          return {
            attemptId: this._id,
            student: this.student,
            quizRef: this.quizRef,
            status: this.status,
            submitTimestamp: this.submitTimestamp,
            revealTimestamp: this.revealTimestamp,
            score: this.score,
            passed: this.passed,
            hasRevealed: this.status !== 'committed',
            revealedAnswers: this.revealedAnswers
          }
        }
      }
    `

    console.log('📦 Deploying QuizAttempt contract module...')

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
          const isAlreadyInBlockchain = lastError.message.includes('Transaction already in block chain')

          if (isAlreadyInBlockchain) {
            console.log(`  ℹ️  Module already deployed, continuing...`)
            // For deploy operations, if already in blockchain, we can try to continue
            // The next operation (encode/broadcast) will use the existing module
            throw lastError // Still throw to handle properly in calling code
          }

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
              console.error(`  2. Use a different wallet with confirmed UTXOs`)
              if (isRegtest) {
                console.error(`  3. On regtest: faucet mining failed, try restarting Bitcoin node`)
              }
              throw new Error(`Mempool ancestor limit: ${lastError.message}`)
            }
            console.log(`  ⏳ Mempool chain too long, waiting for confirmations... (attempt ${attempt}/${maxRetries})`)
            await new Promise(resolve => setTimeout(resolve, 10000))
            continue
          }

          if (!isMempoolConflict) {
            throw lastError
          }

          if (attempt === maxRetries) {
            throw new Error(`${operationName} failed after ${maxRetries} attempts: ${lastError.message}`)
          }

          const delay = attempt * 2000
          console.log(`  ⏳ ${operationName} mempool conflict, retrying in ${delay/1000}s... (attempt ${attempt}/${maxRetries})`)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }

      throw lastError || new Error(`${operationName} failed`)
    }

    const moduleSpecifier = await withMempoolRetry(
      () => computer.deploy(QuizAttemptContract),
      'Deploy QuizAttempt module',
      5
    )
    console.log('✅ Module deployed:', moduleSpecifier)

    console.log('📝 Creating attempt instance from module...')

    const teacherPublicKey = quizRecord.teacher?.publicKey || ''

    const { tx, effect } = await computer.encode({
      mod: moduleSpecifier,
      exp: `new QuizAttempt("${studentPublicKey}", "${body.quizContractRev}", "${answerCommitment}", BigInt(${body.entryFee}), "${teacherPublicKey}")`
    })

    const txId = await computer.broadcast(tx)
    const attempt = effect.res as { _id: string; _rev: string }

    console.log('✅ QuizAttempt deployed successfully!')
    console.log('  Contract ID:', attempt._id)
    console.log('  Contract Rev:', attempt._rev)
    console.log('  TX ID:', txId)

    // Save to database immediately (don't wait for indexer)
    try {
      // Use authenticated user from session
      const student = await prisma.user.findUnique({
        where: { id: session.user.id }
      })

      if (!student) {
        throw new Error('Student user not found')
      }

      // Update user's publicKey if not already set
      if (!student.publicKey) {
        await prisma.user.update({
          where: { id: student.id },
          data: {
            publicKey: studentPublicKey,
            address: computer.getAddress()
          }
        })
        console.log('👤 Updated student wallet info')
      }

      // Find quiz by contractRev or contractId
      const quiz = await prisma.quiz.findFirst({
        where: {
          OR: [
            { contractRev: body.quizContractRev },
            { contractId: body.quizContractId }
          ]
        }
      })

      if (quiz) {
        // Encrypt reveal data for secure server-side storage (production-ready)
        const REVEAL_DATA_KEY = process.env.REVEAL_DATA_KEY || process.env.WALLET_ENCRYPTION_KEY
        if (!REVEAL_DATA_KEY) {
          throw new Error('REVEAL_DATA_KEY environment variable is required')
        }

        const encryptedRevealData = encryptAttemptRevealData(
          { answers: body.answers, nonce: nonce },
          REVEAL_DATA_KEY
        )

        await prisma.quizAttempt.create({
          data: {
            contractId: attempt._id,
            contractRev: attempt._rev,
            moduleSpecifier: moduleSpecifier as string,  // ✅ Store module specifier for reveal
            userId: session.user.id,
            quizId: quiz.id,
            answerCommitment: answerCommitment,
            status: 'COMMITTED',
            submitTimestamp: new Date(),
            encryptedRevealData: encryptedRevealData  // Encrypted answers + nonce for reveal
          }
        })
        console.log('💾 Attempt saved to database with encrypted reveal data')
      } else {
        console.log('⚠️ Quiz not found in database - indexer will sync later')
      }
    } catch (dbError) {
      console.error('⚠️ Failed to save to database (indexer will catch it):', dbError)
    }

    return NextResponse.json({
      success: true,
      attemptId: attempt._id,
      attemptRev: attempt._rev,
      nonce: nonce, // Return nonce - student needs this for reveal!
      commitment: answerCommitment,
      txId: txId
    })

  } catch (error) {
    console.error('❌ Failed to deploy attempt:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to submit attempt'
      },
      { status: 500 }
    )
  }
}
