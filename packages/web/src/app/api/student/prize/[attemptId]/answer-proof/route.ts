import { NextRequest, NextResponse } from 'next/server'
import { PrizeDistributionService, createBitcoinComputer, mineBlocks, waitForMempool } from '@bizz/api'
import { getUserWalletPath } from '@bizz/api/utils/wallet-path'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

/**
 * POST /api/student/prize/[attemptId]/answer-proof
 * Step 6a: Winner creates answer proof
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
    const { answers, score, passed } = body

    if (!answers || score === undefined || passed === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Create student's Bitcoin Computer instance using their unique wallet
    const walletPath = getUserWalletPath(session.user.id, 'STUDENT')
    const studentComputer = createBitcoinComputer({ path: walletPath })

    // Call service
    const result = await PrizeDistributionService.createAnswerProof(studentComputer, {
      attemptId,
      answers,
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
    console.error('Error in create answer proof route:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create answer proof' },
      { status: 500 }
    )
  }
}
