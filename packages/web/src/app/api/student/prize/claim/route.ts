import { NextRequest, NextResponse } from 'next/server'
import { PrizeDistributionService, createBitcoinComputer, mineBlocks, waitForMempool } from '@bizz/api'
import { getUserWalletPath } from '@bizz/api/utils/wallet-path'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

/**
 * POST /api/student/prize/claim
 * Step 6e: Student claims prize payment (releases satoshis)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { prizePaymentId } = body

    if (!prizePaymentId) {
      return NextResponse.json({ error: 'Missing prizePaymentId' }, { status: 400 })
    }

    // Create student's Bitcoin Computer instance using their unique wallet
    const walletPath = getUserWalletPath(session.user.id, 'STUDENT')
    const studentComputer = createBitcoinComputer({ path: walletPath })

    // Call service
    const result = await PrizeDistributionService.claimPrize(studentComputer, {
      prizePaymentId
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    // Wait and mine
    await waitForMempool()
    await mineBlocks(studentComputer, 1)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error in claim prize route:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to claim prize' },
      { status: 500 }
    )
  }
}
