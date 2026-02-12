import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@bizz/database'

/**
 * GET /api/quizzes/[quizId]
 * Get quiz details by contract ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ quizId: string }> }
) {
  try {
    const { quizId } = await params

    const quiz = await prisma.quiz.findUnique({
      where: {
        id: quizId
      },
      include: {
        teacher: {
          select: {
            id: true,
            name: true
          }
        },
        attempts: {
          select: {
            id: true,
            contractId: true,
            status: true,
            score: true,
            passed: true,
            createdAt: true,
            student: {
              select: {
                id: true,
                name: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    })

    if (!quiz) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      quiz: {
        ...quiz,
        prizePool: quiz.prizePool.toString(),
        entryFee: quiz.entryFee.toString()
      }
    })
  } catch (error) {
    console.error('Error fetching quiz:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch quiz' },
      { status: 500 }
    )
  }
}
