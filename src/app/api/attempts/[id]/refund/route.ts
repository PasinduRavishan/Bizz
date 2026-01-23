import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserWallet } from '@/lib/wallet-service'

export const runtime = 'nodejs'

/**
 * POST /api/attempts/[id]/refund
 *
 * Allow students to claim refunds when quiz is abandoned
 * (teacher didn't reveal or didn't distribute before deadlines)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id: attemptId } = await params

    // Get attempt and verify ownership
    const attempt = await prisma.quizAttempt.findFirst({
      where: {
        OR: [
          { id: attemptId },
          { contractId: attemptId }
        ]
      },
      include: {
        quiz: true
      }
    })

    if (!attempt) {
      return NextResponse.json(
        { success: false, error: 'Attempt not found' },
        { status: 404 }
      )
    }

    if (attempt.userId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: 'Not your attempt' },
        { status: 403 }
      )
    }

    // Check if already refunded
    if (attempt.status === 'REFUNDED') {
      return NextResponse.json(
        { success: false, error: 'Refund already claimed' },
        { status: 400 }
      )
    }

    // @ts-expect-error - Bitcoin Computer lib doesn't have type definitions
    await import('@bitcoin-computer/lib')

    console.log('💰 Processing refund claim...')
    console.log('  Attempt ID:', attempt.id)
    console.log('  Quiz ID:', attempt.quiz.id)
    console.log('  Student:', session.user.id)

    // Get student's wallet
    const studentComputer = await getUserWallet(session.user.id)

    // Sync quiz contract to check status and deadlines
    console.log('🔄 Syncing quiz contract...')
    const [quizRev] = await studentComputer.query({ ids: [attempt.quiz.contractId] })
    const quizContract = await studentComputer.sync(quizRev)

    console.log('  Quiz status:', quizContract.status)
    console.log('  Teacher reveal deadline:', new Date(quizContract.teacherRevealDeadline))
    console.log('  Distribution deadline:', new Date(quizContract.distributionDeadline))

    // Sync attempt contract
    console.log('🔄 Syncing attempt contract...')
    const [attemptRev] = await studentComputer.query({ ids: [attempt.contractId] })
    const attemptContract = await studentComputer.sync(attemptRev)

    // Define QuizAttempt contract (with claimRefund method)
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

    // Deploy QuizAttempt module
    console.log('📦 Deploying QuizAttempt module...')
    const attemptModuleSpec = await studentComputer.deploy(QuizAttemptContract)

    // Call claimRefund method
    console.log('🔄 Calling claimRefund()...')
    const { tx } = await studentComputer.encodeCall({
      target: attemptContract,
      property: 'claimRefund',
      args: [quizContract],
      mod: attemptModuleSpec
    })

    const txId = await studentComputer.broadcast(tx)
    console.log('✅ Refund claimed! TX ID:', txId)

    // Update database
    await prisma.quizAttempt.update({
      where: { id: attempt.id },
      data: { status: 'REFUNDED' }
    })

    // Refresh student balance
    const { balance } = await studentComputer.getBalance()
    await prisma.user.update({
      where: { id: session.user.id },
      data: { walletBalance: balance.toString() }
    })

    const refundedAmount = Number(attempt.quiz.entryFee) - 546

    return NextResponse.json({
      success: true,
      message: 'Refund claimed successfully',
      refundedAmount,
      txId
    })

  } catch (error) {
    console.error('❌ Failed to claim refund:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to claim refund'
      },
      { status: 500 }
    )
  }
}
