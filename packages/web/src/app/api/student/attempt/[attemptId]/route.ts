import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@bizz/database'

/**
 * GET /api/student/attempt/[attemptId]
 * Get attempt details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  try {
    const { attemptId } = await params

    const attempt = await prisma.quizAttempt.findUnique({
      where: {
        contractId: attemptId
      },
      include: {
        quiz: {
          select: {
            id: true,
            contractId: true,
            symbol: true,
            title: true,
            questionHashIPFS: true,
            questionCount: true,
            prizePool: true,
            entryFee: true,
            passThreshold: true,
            status: true,
            revealedAnswers: true
          }
        },
        student: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    if (!attempt) {
      return NextResponse.json({ error: 'Attempt not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      attempt: {
        ...attempt,
        quiz: {
          ...attempt.quiz,
          prizePool: attempt.quiz.prizePool.toString(),
          entryFee: attempt.quiz.entryFee.toString()
        }
      }
    })
  } catch (error) {
    console.error('Error fetching attempt:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch attempt' },
      { status: 500 }
    )
  }
}
