import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'STUDENT') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Fetch user's quiz attempts with quiz details
    const attempts = await prisma.quizAttempt.findMany({
      where: {
        userId: session.user.id
      },
      include: {
        quiz: {
          select: {
            id: true,
            title: true,
            description: true,
            questionCount: true,
            passThreshold: true,
            status: true,
            deadline: true,
            teacherRevealDeadline: true,
            distributionDeadline: true,
            entryFee: true
          }
        }
      },
      orderBy: {
        submitTimestamp: 'desc'
      }
    })

    // Calculate stats
    const totalAttempts = attempts.length
    const completedAttempts = attempts.filter(a => a.status === 'VERIFIED').length
    const passedQuizzes = attempts.filter(a => a.passed === true).length
    const totalEarnings = attempts
      .filter(a => a.prizeAmount)
      .reduce((sum, a) => sum + Number(a.prizeAmount || 0), 0)

    // Format earnings in BTC
    const earningsBTC = (totalEarnings / 100000000).toFixed(8)

    // Calculate refundable attempts
    const now = new Date()
    const refundableAttempts = attempts.filter(attempt => {
      // Already refunded
      if (attempt.status === 'REFUNDED') return false

      // Quiz is abandoned
      if (attempt.quiz.status === 'REFUNDED' || attempt.quiz.status === 'ABANDONED') {
        return true
      }

      // Quiz revealed but distribution deadline passed
      if (
        attempt.quiz.status === 'REVEALED' &&
        attempt.quiz.distributionDeadline &&
        now > new Date(attempt.quiz.distributionDeadline)
      ) {
        return true
      }

      return false
    }).map(attempt => ({
      ...attempt,
      refundReason: attempt.quiz.status === 'REFUNDED' || attempt.quiz.status === 'ABANDONED'
        ? 'Quiz was abandoned by teacher'
        : 'Teacher missed distribution deadline',
      refundAmount: attempt.quiz.entryFee
    }))

    const totalRefundable = refundableAttempts.reduce(
      (sum, attempt) => sum + Number(attempt.quiz.entryFee),
      0
    )

    return NextResponse.json({
      attempts: attempts.map(attempt => ({
        id: attempt.id,
        contractId: attempt.contractId,
        status: attempt.status,
        score: attempt.score,
        passed: attempt.passed,
        prizeAmount: attempt.prizeAmount?.toString() || null,
        submitTimestamp: attempt.submitTimestamp.toISOString(),
        revealTimestamp: attempt.revealTimestamp?.toISOString() || null,
        answerCommitment: attempt.answerCommitment,
        paymentContractRev: attempt.paymentContractRev,
        quiz: {
          id: attempt.quiz.id,
          title: attempt.quiz.title,
          description: attempt.quiz.description,
          questionCount: attempt.quiz.questionCount,
          passThreshold: attempt.quiz.passThreshold,
          status: attempt.quiz.status,
          deadline: attempt.quiz.deadline.toISOString(),
          teacherRevealDeadline: attempt.quiz.teacherRevealDeadline?.toISOString() || null,
          distributionDeadline: attempt.quiz.distributionDeadline?.toISOString() || null,
          entryFee: attempt.quiz.entryFee.toString()
        }
      })),
      refundableAttempts: refundableAttempts.map(attempt => ({
        id: attempt.id,
        contractId: attempt.contractId,
        status: attempt.status,
        prizeAmount: attempt.prizeAmount?.toString() || null,
        refundReason: attempt.refundReason,
        refundAmount: attempt.refundAmount.toString(),
        quiz: {
          id: attempt.quiz.id,
          title: attempt.quiz.title,
          status: attempt.quiz.status,
          entryFee: attempt.quiz.entryFee.toString()
        }
      })),
      stats: {
        totalAttempts,
        completedAttempts,
        passedQuizzes,
        totalEarnings: earningsBTC,
        totalRefundable,
        refundableCount: refundableAttempts.length
      }
    })
  } catch (error) {
    console.error('Student dashboard error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
