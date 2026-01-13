import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hashCommitment, generateNonce, encryptAttemptRevealData } from '@/lib/crypto'
import { prisma } from '@/lib/prisma'
import { getUserWallet } from '@/lib/wallet-service'

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

    // Check if quiz exists and get deadline
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
        questionCount: true
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

    // Define QuizAttempt contract inline (pure JavaScript, no imports)
    // Following the same pattern as Quiz contract deployment
    const QuizAttemptContract = `
      export class QuizAttempt extends Contract {
        constructor(student, quizRef, answerCommitment, entryFee) {
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
            answerCommitment: answerCommitment,
            revealedAnswers: null,
            nonce: null,
            score: null,
            passed: null,
            status: 'committed',
            submitTimestamp: Date.now(),
            revealTimestamp: null,
            version: '1.0.0'
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
    const moduleSpecifier = await computer.deploy(QuizAttemptContract)
    console.log('✅ Module deployed:', moduleSpecifier)

    console.log('📝 Creating attempt instance from module...')

    const { tx, effect } = await computer.encode({
      mod: moduleSpecifier,
      exp: `new QuizAttempt("${studentPublicKey}", "${body.quizContractRev}", "${answerCommitment}", BigInt(${body.entryFee}))`
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
            studentId: session.user.id,
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
