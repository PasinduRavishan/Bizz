import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@bizz/database'

/**
 * GET /api/student/attempts?studentId=xxx
 * Get all attempts for a student
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const studentId = searchParams.get('studentId') || 'temp-student-id' // TODO: from session

    const attempts = await prisma.quizAttempt.findMany({
      where: {
        userId: studentId
      },
      include: {
        quiz: {
          select: {
            id: true,
            contractId: true,
            symbol: true,
            title: true,
            prizePool: true,
            entryFee: true,
            passThreshold: true,
            status: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json({
      success: true,
      attempts: attempts.map(a => ({
        ...a,
        quiz: {
          ...a.quiz,
          prizePool: a.quiz.prizePool.toString(),
          entryFee: a.quiz.entryFee.toString()
        }
      }))
    })
  } catch (error) {
    console.error('Error fetching attempts:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch attempts' },
      { status: 500 }
    )
  }
}
