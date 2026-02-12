import { NextRequest, NextResponse } from 'next/server'
import { createBitcoinComputer, mineBlocks } from '@bizz/api/utils/bitcoin-computer-server'
import { getUserWalletPath } from '@bizz/api/utils/wallet-path'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

/**
 * POST /api/wallet/faucet
 * Fund current user's wallet (development only)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get unique wallet path for this user
    const role = session.user.role === 'BOTH' ? 'TEACHER' : session.user.role
    const walletPath = getUserWalletPath(session.user.id, role)
    const computer = createBitcoinComputer({ path: walletPath })
    const address = computer.getAddress()

    console.log(`💰 Faucet request for ${role} wallet: ${address}`)

    // Fund wallet with 1,000,000 sats
    await computer.faucet(1000000)

    // Mine a block to confirm
    await mineBlocks(computer, 1)

    // Get new balance
    const balanceResult = await computer.getBalance()

    console.log(`✅ Wallet funded - New balance: ${Number(balanceResult.balance)} sats`)

    return NextResponse.json({
      success: true,
      message: 'Wallet funded successfully',
      address,
      balance: Number(balanceResult.balance),
      balanceSats: Number(balanceResult.balance),
      confirmed: Number(balanceResult.confirmed),
      unconfirmed: Number(balanceResult.unconfirmed)
    })
  } catch (error) {
    console.error('Error funding wallet:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fund wallet' },
      { status: 500 }
    )
  }
}
