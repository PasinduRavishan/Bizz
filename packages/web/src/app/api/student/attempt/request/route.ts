import { NextRequest, NextResponse } from 'next/server'
import { StudentAttemptService, createBitcoinComputer, mineBlocks, waitForMempool } from '@bizz/api'
import { getUserWalletPath } from '@bizz/api/utils/wallet-path'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

/**
 * POST /api/student/attempt/request
 * Step 2: Student requests an attempt
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { quizId } = body

    const studentId = session.user.id

    // Create student's Bitcoin Computer instance using their unique wallet
    const walletPath = getUserWalletPath(studentId, 'STUDENT')
    const studentComputer = createBitcoinComputer({ path: walletPath })

    // Call service
    const result = await StudentAttemptService.requestAttempt(studentComputer, {
      studentId,
      quizId
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    // Wait and mine
    await waitForMempool()
    await mineBlocks(studentComputer, 1)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error in request attempt route:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to request attempt' },
      { status: 500 }
    )
  }
}
