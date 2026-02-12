import { NextRequest, NextResponse } from 'next/server'
import { TeacherRevealService, createBitcoinComputer, mineBlocks, waitForMempool } from '@bizz/api'
import { getUserWalletPath } from '@bizz/api/utils/wallet-path'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

/**
 * POST /api/student/attempt/[attemptId]/verify
 * Step 5b: Student verifies their attempt after teacher reveals
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { attemptId } = await params
    const body = await request.json()
    const { score, passed } = body

    if (score === undefined || passed === undefined) {
      return NextResponse.json({ error: 'Missing score or passed' }, { status: 400 })
    }

    // Create student's Bitcoin Computer instance using their unique wallet
    const walletPath = getUserWalletPath(session.user.id, 'STUDENT')
    const studentComputer = createBitcoinComputer({ path: walletPath })

    // Call service
    const result = await TeacherRevealService.verifyAttempt(studentComputer, {
      attemptId,
      score,
      passed
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    // Wait and mine
    await waitForMempool()
    await mineBlocks(studentComputer, 1)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error in verify attempt route:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to verify attempt' },
      { status: 500 }
    )
  }
}
