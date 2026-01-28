import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

/**
 * GET /api/wallet/info
 * Returns wallet information for the authenticated user
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        address: true,
        walletBalance: true,
        lastBalanceCheck: true,
        walletType: true,
        encryptedMnemonic: true
      }
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // If user doesn't have a wallet yet, return a message
    if (!user.encryptedMnemonic || !user.address) {
      return NextResponse.json(
        { success: false, error: 'Wallet not initialized. Please contact support.' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      wallet: {
        address: user.address,
        balance: Number(user.walletBalance || 0),
        lastBalanceCheck: user.lastBalanceCheck?.toISOString() || null,
        walletType: user.walletType
      }
    })
  } catch (error) {
    console.error('Failed to get wallet info:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
