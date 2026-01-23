import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createComputer } from '@/lib/bitcoin-computer'

export const runtime = 'nodejs'

/**
 * POST /api/quizzes/[id]/mark-abandoned
 *
 * Mark a quiz as abandoned when teacher missed reveal or distribution deadlines
 * Anyone can call this after deadlines pass (enables student refunds)
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

    const { id: quizId } = await params

    // Get quiz
    const quiz = await prisma.quiz.findFirst({
      where: {
        OR: [
          { id: quizId },
          { contractId: quizId }
        ]
      }
    })

    if (!quiz) {
      return NextResponse.json(
        { success: false, error: 'Quiz not found' },
        { status: 404 }
      )
    }

    // Already abandoned or refunded
    if (quiz.status === 'REFUNDED' || quiz.status === 'ABANDONED') {
      return NextResponse.json(
        { success: false, error: 'Quiz already marked as abandoned' },
        { status: 400 }
      )
    }

    // Quiz must be revealed or active (can't abandon a completed quiz)
    if (quiz.status === 'COMPLETED') {
      return NextResponse.json(
        { success: false, error: 'Cannot abandon a completed quiz' },
        { status: 400 }
      )
    }

    // @ts-expect-error - Bitcoin Computer lib doesn't have type definitions
    await import('@bitcoin-computer/lib')

    console.log('⚠️  Marking quiz as abandoned...')
    console.log('  Quiz ID:', quiz.id)
    console.log('  Current status:', quiz.status)

    // Create a computer instance (doesn't matter whose wallet)
    const computer = await createComputer()

    // Sync quiz contract
    console.log('🔄 Syncing quiz contract...')
    const [quizRev] = await computer.query({ ids: [quiz.contractId] })
    const quizContract = await computer.sync(quizRev)

    console.log('  Quiz status:', quizContract.status)
    console.log('  Teacher reveal deadline:', new Date(quizContract.teacherRevealDeadline))
    if (quizContract.distributionDeadline) {
      console.log('  Distribution deadline:', new Date(quizContract.distributionDeadline))
    }

    // Define Quiz contract (with markAbandoned method)
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
        constructor(teacher, questionHashIPFS, answerHashes, prizePool, entryFee, passThreshold, deadline, studentRevealDeadline, teacherRevealDeadline, distributionDeadline) {
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
            _satoshis: 546n,
            teacher: teacher,
            questionHashIPFS: questionHashIPFS,
            answerHashes: answerHashes,
            questionCount: answerHashes.length,
            entryFee: entryFee,
            prizePool: prizePool,
            passThreshold: passThreshold,
            platformFee: 0.02,
            deadline: deadline,
            studentRevealDeadline: studentRevealDeadline,
            teacherRevealDeadline: teacherRevealDeadline,
            distributionDeadline: distributionDeadline,
            status: 'active',
            revealedAnswers: null,
            salt: null,
            winners: [],
            createdAt: Date.now(),
            version: '1.1.0'
          })
        }

        revealAnswers(answers, salt) {
          if (!this._owners.includes(this.teacher)) {
            throw new Error('Only teacher can reveal answers')
          }
          if (Date.now() < this.studentRevealDeadline) {
            throw new Error('Must wait for student reveal window to close')
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

        distributePrizes() {
          if (this.status !== 'revealed') {
            throw new Error('Quiz must be revealed first')
          }
          if (!this._owners.includes(this.teacher)) {
            throw new Error('Only teacher can distribute prizes')
          }
          if (Date.now() > this.distributionDeadline) {
            throw new Error('Distribution deadline has passed')
          }

          this.status = 'completed'
          this.distributedAt = Date.now()
        }

        markAbandoned() {
          if (this.status !== 'revealed' && this.status !== 'active') {
            throw new Error('Quiz must be revealed or active to mark as abandoned')
          }

          const teacherMissedReveal = (this.status === 'active' && Date.now() > this.teacherRevealDeadline)
          const missedDistribution = (this.status === 'revealed' && Date.now() > this.distributionDeadline)

          if (!teacherMissedReveal && !missedDistribution) {
            throw new Error('Cannot mark as abandoned: deadlines not passed')
          }

          this.status = 'abandoned'
          this.abandonedAt = Date.now()
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

    // Deploy Quiz module
    console.log('📦 Deploying Quiz module...')
    const quizModuleSpec = await computer.deploy(QuizContract)

    // Call markAbandoned method
    console.log('🔄 Calling markAbandoned()...')
    const { tx } = await computer.encodeCall({
      target: quizContract,
      property: 'markAbandoned',
      args: [],
      mod: quizModuleSpec
    })

    const txId = await computer.broadcast(tx)
    console.log('✅ Quiz marked as abandoned! TX ID:', txId)

    // Update database
    await prisma.quiz.update({
      where: { id: quiz.id },
      data: { status: 'REFUNDED' } // Using REFUNDED status as ABANDONED isn't in schema yet
    })

    return NextResponse.json({
      success: true,
      message: 'Quiz marked as abandoned. Students can now claim refunds.',
      txId
    })

  } catch (error) {
    console.error('❌ Failed to mark quiz as abandoned:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to mark quiz as abandoned'
      },
      { status: 500 }
    )
  }
}
