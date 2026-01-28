import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getUserBalance } from '@/lib/wallet-service'

export const runtime = 'nodejs'

/**
 * POST /api/user/balance/refresh
 * 
 * Refresh current user's wallet balance from blockchain
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log(`🔄 Refreshing balance for user ${session.user.id}`)

    // Get fresh balance from blockchain
    const balance = await getUserBalance(session.user.id)

    return NextResponse.json({
      success: true,
      data: {
        balance: balance.toString(),
        balanceBTC: (Number(balance) / 1e8).toFixed(8)
      }
    })

  } catch (error) {
    console.error('❌ Failed to refresh balance:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to refresh balance'
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/user/balance/refresh
 * 
 * Get current user's wallet balance (cached from database)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { prisma } = await import('@/lib/prisma')
    
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        walletBalance: true,
        address: true,
        lastBalanceCheck: true
      }
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        balance: user.walletBalance?.toString() || '0',
        balanceBTC: user.walletBalance ? (Number(user.walletBalance) / 1e8).toFixed(8) : '0',
        address: user.address,
        lastCheck: user.lastBalanceCheck?.toISOString()
      }
    })

  } catch (error) {
    console.error('❌ Failed to get balance:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get balance'
      },
      { status: 500 }
    )
  }
}
