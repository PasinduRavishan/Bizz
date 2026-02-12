import { NextRequest, NextResponse } from 'next/server'
import { AnswerSubmissionService, createBitcoinComputer, mineBlocks, waitForMempool } from '@bizz/api'
import { getUserWalletPath } from '@bizz/api/utils/wallet-path'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

/**
 * POST /api/student/attempt/submit
 * Step 4: Student submits answers
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { attemptId, answers } = body

    if (!attemptId || !answers || !Array.isArray(answers)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const studentId = session.user.id

    // Create student's Bitcoin Computer instance using their unique wallet
    const walletPath = getUserWalletPath(studentId, 'STUDENT')
    const studentComputer = createBitcoinComputer({ path: walletPath })

    // Call service
    const result = await AnswerSubmissionService.submitAnswers(studentComputer, {
      studentId,
      attemptId,
      answers
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    // Wait and mine
    await waitForMempool()
    await mineBlocks(studentComputer, 1)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error in submit answers route:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to submit answers' },
      { status: 500 }
    )
  }
}
