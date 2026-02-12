import { NextRequest, NextResponse } from 'next/server'
import { PrizeDistributionService, createBitcoinComputer, mineBlocks, waitForMempool } from '@bizz/api'
import { getUserWalletPath } from '@bizz/api/utils/wallet-path'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

/**
 * POST /api/student/prize/[attemptId]/swap/complete
 * Step 6d: Student completes prize swap
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
    const { partialSwapTx } = body

    if (!partialSwapTx) {
      return NextResponse.json({ error: 'Missing partialSwapTx' }, { status: 400 })
    }

    // Create student's Bitcoin Computer instance using their unique wallet
    const walletPath = getUserWalletPath(session.user.id, 'STUDENT')
    const studentComputer = createBitcoinComputer({ path: walletPath })

    // Call service
    const result = await PrizeDistributionService.completePrizeSwap(studentComputer, {
      attemptId,
      partialSwapTx
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    // Wait and mine
    await waitForMempool()
    await mineBlocks(studentComputer, 1)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error in complete prize swap route:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to complete prize swap' },
      { status: 500 }
    )
  }
}
