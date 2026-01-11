import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getUserBalance } from '@/lib/wallet-service'

export const runtime = 'nodejs'

/**
 * POST /api/wallet/balance
 * Refreshes the wallet balance for the authenticated user
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('🔄 Refreshing balance for user:', session.user.id)
    
    const balance = await getUserBalance(session.user.id)
    
    return NextResponse.json({
      success: true,
      balance: Number(balance)
    })
  } catch (error) {
    console.error('Failed to refresh balance:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to refresh balance' },
      { status: 500 }
    )
  }
}
