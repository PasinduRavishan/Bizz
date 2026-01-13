import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

/**
 * GET /api/quizzes/[id]/answers
 *
 * Get the correct answers for a quiz.
 * Only accessible by the quiz creator (teacher).
 * Returns the stored correct answers for reveal phase.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: quizId } = await params

    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Find the quiz
    const quiz = await prisma.quiz.findFirst({
      where: {
        OR: [
          { id: quizId },
          { contractId: quizId }
        ]
      },
      include: {
        teacher: {
          select: {
            id: true
          }
        }
      }
    })

    if (!quiz) {
      return NextResponse.json(
        { success: false, error: 'Quiz not found' },
        { status: 404 }
      )
    }

    // Only the quiz owner can access answers
    if (quiz.teacherId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: 'Only the quiz creator can access answers' },
        { status: 403 }
      )
    }

    // Get questions from database (they include correct answer indices)
    const questions = quiz.questions as Array<{
      question: string
      options: string[]
      correctAnswer?: number
    }> | null

    if (!questions || questions.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Questions not found in database' },
        { status: 404 }
      )
    }

    // Extract correct answers from questions
    // Note: We need the actual answer text, not the index
    // But the questions stored in DB might not have correctAnswer field
    // In that case, we can't reconstruct the answers

    // Check if we have revealed answers already
    if (quiz.revealedAnswers && quiz.revealedAnswers.length > 0) {
      return NextResponse.json({
        success: true,
        answers: quiz.revealedAnswers,
        salt: quiz.salt,
        source: 'revealed'
      })
    }

    // For quizzes that haven't been revealed yet, we need to check
    // if the questions have correctAnswer field (they shouldn't for security)
    // The answers should have been stored by the frontend when creating

    // For now, return an error - the frontend should have stored this
    return NextResponse.json({
      success: false,
      error: 'Answers not available. Please use the stored data from quiz creation.',
      salt: quiz.salt
    }, { status: 404 })

  } catch (error) {
    console.error('Failed to get quiz answers:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to get quiz answers' },
      { status: 500 }
    )
  }
}
