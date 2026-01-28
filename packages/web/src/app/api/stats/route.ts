import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { QuizStatus, AttemptStatus } from '@prisma/client'

// GET /api/stats - Get platform statistics
export async function GET() {
  try {
    // Aggregate stats from database
    const [
      totalQuizzes,
      activeQuizzes,
      totalAttempts,
      totalUsers,
      totalTeachers,
      totalStudents,
      verifiedAttempts,
      passedAttempts
    ] = await Promise.all([
      prisma.quiz.count(),
      prisma.quiz.count({ where: { status: QuizStatus.ACTIVE } }),
      prisma.quizAttempt.count(),
      prisma.user.count(),
      prisma.user.count({ where: { role: 'TEACHER' } }),
      prisma.user.count({ where: { role: 'STUDENT' } }),
      prisma.quizAttempt.count({ where: { status: AttemptStatus.VERIFIED } }),
      prisma.quizAttempt.count({ where: { passed: true } })
    ])

    // Calculate prize pools
    const prizePools = await prisma.quiz.aggregate({
      _sum: {
        prizePool: true
      },
      where: {
        status: QuizStatus.ACTIVE
      }
    })

    const totalPaid = await prisma.winner.aggregate({
      _sum: {
        prizeAmount: true
      },
      where: {
        paid: true
      }
    })

    // Calculate average score
    const scores = await prisma.quizAttempt.aggregate({
      _avg: {
        score: true
      },
      where: {
        status: AttemptStatus.VERIFIED
      }
    })

    // Calculate platform revenue (2% of all entry fees)
    const entryFees = await prisma.quizAttempt.aggregate({
      _count: true
    })
    const avgEntryFee = await prisma.quiz.aggregate({
      _avg: {
        entryFee: true
      }
    })
    
    const platformFeeRate = 0.02
    const estimatedRevenue = entryFees._count * Number(avgEntryFee._avg.entryFee || 0) * platformFeeRate

    const stats = {
      totalQuizzes,
      activeQuizzes,
      totalAttempts,
      totalUsers,
      totalTeachers,
      totalStudents,
      totalPrizePool: Number(prizePools._sum.prizePool || 0) / 100000000, // Convert satoshis to LTC
      totalPaid: Number(totalPaid._sum.prizeAmount || 0) / 100000000,
      platformRevenue: estimatedRevenue / 100000000,
      averageScore: scores._avg.score || 0,
      passRate: verifiedAttempts > 0 ? passedAttempts / verifiedAttempts : 0
    }
    
    return NextResponse.json({
      success: true,
      data: stats
    })
  } catch (error) {
    console.error('Failed to fetch stats:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch stats' },
      { status: 500 }
    )
  }
}
