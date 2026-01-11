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

    if (session.user.role !== 'TEACHER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Fetch user's quizzes with attempt counts
    const quizzes = await prisma.quiz.findMany({
      where: {
        teacherId: session.user.id
      },
      include: {
        _count: {
          select: {
            attempts: true,
            winners: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Calculate stats
    const totalQuizzes = quizzes.length
    const activeQuizzes = quizzes.filter(q => q.status === 'ACTIVE').length
    const totalAttempts = quizzes.reduce((sum, q) => sum + q._count.attempts, 0)
    
    // Calculate total revenue (entry fees collected)
    const totalRevenue = quizzes.reduce((sum, q) => {
      const revenue = Number(q.entryFee) * q._count.attempts
      return sum + revenue
    }, 0)

    // Format revenue in BTC
    const revenueBTC = (totalRevenue / 100000000).toFixed(8)

    return NextResponse.json({
      quizzes: quizzes.map(quiz => ({
        ...quiz,
        entryFee: quiz.entryFee.toString(),
        prizePool: quiz.prizePool.toString()
      })),
      stats: {
        totalQuizzes,
        activeQuizzes,
        totalAttempts,
        totalRevenue: revenueBTC
      }
    })
  } catch (error) {
    console.error('Teacher dashboard error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
