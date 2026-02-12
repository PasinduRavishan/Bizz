import { NextRequest, NextResponse } from 'next/server'
import { PrizeDistributionService, createBitcoinComputer } from '@bizz/api'
import { getUserWalletPath } from '@bizz/api/utils/wallet-path'
import { prisma } from '@bizz/database'

/**
 * POST /api/student/prize/[attemptId]/swap/prepare
 * Step 6c: Teacher prepares prize swap transaction
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  try {
    const { attemptId } = await params

    // Get attempt to find quiz and teacher
    const attempt = await prisma.quizAttempt.findUnique({
      where: { id: attemptId },
      include: { quiz: true }
    })
    if (!attempt) {
      return NextResponse.json({ error: 'Attempt not found' }, { status: 404 })
    }

    // Create teacher's Bitcoin Computer instance using their unique wallet
    const walletPath = getUserWalletPath(attempt.quiz.teacherId, 'TEACHER')
    const teacherComputer = createBitcoinComputer({ path: walletPath })

    // Call service
    const result = await PrizeDistributionService.preparePrizeSwap(teacherComputer, {
      attemptId
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error in prepare prize swap route:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to prepare prize swap' },
      { status: 500 }
    )
  }
}
