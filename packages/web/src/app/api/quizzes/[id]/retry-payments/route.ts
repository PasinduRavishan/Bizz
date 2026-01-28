import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { processCompletePayments } from '@/lib/payment-distribution'

export const runtime = 'nodejs'

/**
 * POST /api/quizzes/[id]/retry-payments
 * 
 * Retry payment distribution for a revealed quiz
 * Only accessible by the quiz teacher
 */
export async function POST(
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
      }
    })

    if (!quiz) {
      return NextResponse.json(
        { success: false, error: 'Quiz not found' },
        { status: 404 }
      )
    }

    // Verify the teacher owns this quiz
    if (quiz.teacherId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: 'You can only retry payments for your own quizzes' },
        { status: 403 }
      )
    }

    // Check quiz is in revealed status
    if (quiz.status !== 'REVEALED' && quiz.status !== 'COMPLETED') {
      return NextResponse.json(
        { success: false, error: `Cannot retry payments for quiz in ${quiz.status} status` },
        { status: 400 }
      )
    }

    console.log('🔄 Retrying payment distribution...')
    console.log('  Quiz ID:', quiz.id)
    console.log('  Teacher:', session.user.id)

    // Retry payment processing using contract-based approach
    const paymentResults = await processCompletePayments(quiz.id)

    console.log('✅ Payment retry complete')

    // Convert BigInt to string for JSON
    const convertBigIntToString = (obj: any): any => {
      if (obj === null || obj === undefined) return obj
      if (typeof obj === 'bigint') return obj.toString()
      if (Array.isArray(obj)) return obj.map(convertBigIntToString)
      if (typeof obj === 'object') {
        const converted: any = {}
        for (const [key, value] of Object.entries(obj)) {
          converted[key] = convertBigIntToString(value)
        }
        return converted
      }
      return obj
    }

    return NextResponse.json({
      success: true,
      message: 'Payment distribution completed',
      results: convertBigIntToString(paymentResults)
    })

  } catch (error) {
    console.error('Payment retry error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to retry payments'
      },
      { status: 500 }
    )
  }
}
