import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { processCompletePayments } from '@/lib/payment-distribution'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

/**
 * POST /api/quizzes/[id]/distribute
 * 
 * Manually trigger complete payment distribution for a quiz
 * Distributes prizes AND collects entry fees
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

    // Only teacher can trigger distribution
    if (quiz.teacherId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: 'Only the quiz creator can trigger distribution' },
        { status: 403 }
      )
    }

    // Quiz must be revealed
    if (quiz.status !== 'REVEALED' && quiz.status !== 'COMPLETED') {
      return NextResponse.json(
        { success: false, error: 'Quiz must be revealed before distributing payments' },
        { status: 400 }
      )
    }

    // ✅ NEW: Check distribution deadline
    if (quiz.distributionDeadline && new Date() > quiz.distributionDeadline) {
      return NextResponse.json(
        {
          success: false,
          error: 'Distribution deadline has passed. Quiz can be marked as abandoned for student refunds.'
        },
        { status: 400 }
      )
    }

    console.log(`🎁 Manual payment distribution triggered for quiz ${quiz.id}`)

    // Process complete payments
    const results = await processCompletePayments(quiz.id)

    return NextResponse.json({
      success: true,
      message: 'Payment distribution completed',
      data: results
    })

  } catch (error) {
    console.error('❌ Failed to distribute payments:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to distribute payments'
      },
      { status: 500 }
    )
  }
}
