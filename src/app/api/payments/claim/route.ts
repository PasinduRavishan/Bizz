import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { claimPayment } from '@/lib/payment-distribution'

export const runtime = 'nodejs'

/**
 * POST /api/payments/claim
 * 
 * Claim a payment contract (for winners to receive their prizes)
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

    const { paymentRev } = await request.json()

    if (!paymentRev) {
      return NextResponse.json(
        { success: false, error: 'Payment revision required' },
        { status: 400 }
      )
    }

    console.log(`📥 Claiming payment: ${paymentRev}`)

    // Claim the payment
    const result = await claimPayment(session.user.id, paymentRev)

    return NextResponse.json({
      success: true,
      message: 'Payment claimed successfully',
      data: result
    })

  } catch (error) {
    console.error('❌ Failed to claim payment:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to claim payment'
      },
      { status: 500 }
    )
  }
}
