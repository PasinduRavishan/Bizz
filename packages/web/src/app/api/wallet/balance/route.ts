import { NextRequest, NextResponse } from 'next/server'
import { createBitcoinComputer } from '@bizz/api/utils/bitcoin-computer-server'
import { getUserWalletPath } from '@bizz/api/utils/wallet-path'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

/**
 * GET /api/wallet/balance
 * Get current wallet balance and address
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get unique wallet path for this user
    // If user has BOTH roles, default to TEACHER wallet
    const role = session.user.role === 'BOTH' ? 'TEACHER' : session.user.role
    const walletPath = getUserWalletPath(session.user.id, role)
    const computer = createBitcoinComputer({ path: walletPath })
    const address = computer.getAddress()

    // Get balance from Bitcoin Computer
    const balanceResult = await computer.getBalance()

    return NextResponse.json({
      success: true,
      address,
      balance: Number(balanceResult.balance),
      balanceSats: Number(balanceResult.balance),
      confirmed: Number(balanceResult.confirmed),
      unconfirmed: Number(balanceResult.unconfirmed)
    })
  } catch (error) {
    console.error('Error fetching wallet balance:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch balance' },
      { status: 500 }
    )
  }
}
