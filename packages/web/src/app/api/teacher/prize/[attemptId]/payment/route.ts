import { NextRequest, NextResponse } from 'next/server'
import { PrizeDistributionService, createBitcoinComputer, mineBlocks, waitForMempool } from '@bizz/api'
import { getUserWalletPath } from '@bizz/api/utils/wallet-path'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

/**
 * POST /api/teacher/prize/[attemptId]/payment
 * Step 6b: Teacher creates prize payment for winner
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
    const { studentPubKey, amount } = body

    if (!studentPubKey || !amount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Create teacher's Bitcoin Computer instance using their unique wallet
    const walletPath = getUserWalletPath(session.user.id, 'TEACHER')
    const teacherComputer = createBitcoinComputer({ path: walletPath })

    // Call service
    const result = await PrizeDistributionService.createPrizePayment(teacherComputer, {
      attemptId,
      studentPubKey,
      amount: BigInt(amount)
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    // Wait and mine
    await waitForMempool()
    await mineBlocks(teacherComputer, 1)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error in create prize payment route:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create prize payment' },
      { status: 500 }
    )
  }
}
