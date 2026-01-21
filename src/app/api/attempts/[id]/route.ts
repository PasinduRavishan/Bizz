import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

/**
 * GET /api/attempts/[id]
 *
 * Get detailed information about a specific quiz attempt
 * Used for the student attempt details view
 */
export async function GET(
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

    // Get the attempt with full quiz details
    const attempt = await prisma.quizAttempt.findUnique({
      where: { id: attemptId },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            address: true
          }
        },
        quiz: {
          select: {
            id: true,
            contractId: true,
            title: true,
            description: true,
            questionCount: true,
            passThreshold: true,
            status: true,
            prizePool: true,
            entryFee: true,
            deadline: true,
            teacherRevealDeadline: true,
            _count: {
              select: {
                attempts: true,
                winners: true
              }
            }
          }
        },
        winner: true
      }
    })

    if (!attempt) {
      return NextResponse.json(
        { success: false, error: 'Attempt not found' },
        { status: 404 }
      )
    }

    // Check if user has access (either the student or the quiz teacher)
    const quiz = await prisma.quiz.findUnique({
      where: { id: attempt.quizId },
      select: { teacherId: true }
    })

    const isStudent = attempt.studentId === session.user.id
    const isTeacher = quiz?.teacherId === session.user.id

    if (!isStudent && !isTeacher) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized to view this attempt' },
        { status: 403 }
      )
    }

    // Calculate rank if winner
    let rank: number | undefined
    if (attempt.winner) {
      const betterWinners = await prisma.winner.count({
        where: {
          quizId: attempt.quizId,
          score: { gt: attempt.winner.score }
        }
      })
      rank = betterWinners + 1
    }

    // Format response
    const responseData = {
      id: attempt.id,
      contractId: attempt.contractId,
      status: attempt.status,
      score: attempt.score,
      passed: attempt.passed,
      prizeAmount: attempt.prizeAmount?.toString() || null,
      submitTimestamp: attempt.submitTimestamp.toISOString(),
      revealTimestamp: attempt.revealTimestamp?.toISOString() || null,
      answerCommitment: attempt.answerCommitment,
      student: attempt.student,
      quiz: {
        id: attempt.quiz.id,
        contractId: attempt.quiz.contractId,
        title: attempt.quiz.title,
        description: attempt.quiz.description,
        questionCount: attempt.quiz.questionCount,
        passThreshold: attempt.quiz.passThreshold,
        status: attempt.quiz.status,
        prizePool: attempt.quiz.prizePool.toString(),
        entryFee: attempt.quiz.entryFee.toString(),
        deadline: attempt.quiz.deadline.toISOString(),
        winnersCount: attempt.quiz._count.winners,
        totalAttempts: attempt.quiz._count.attempts
      },
      rank
    }

    return NextResponse.json({
      success: true,
      data: responseData
    })

  } catch (error) {
    console.error('Error fetching attempt details:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch attempt details' },
      { status: 500 }
    )
  }
}
