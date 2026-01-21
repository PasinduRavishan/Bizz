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
        studentId: session.user.id
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

            teacherRevealDeadline: true
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

    return NextResponse.json({
      attempts: attempts.map(attempt => ({
        ...attempt,
        prizeAmount: attempt.prizeAmount?.toString() || null
      })),
      stats: {
        totalAttempts,
        completedAttempts,
        passedQuizzes,
        totalEarnings: earningsBTC
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
