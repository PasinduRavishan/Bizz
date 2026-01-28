import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserWallet } from '@/lib/wallet-service'

export const runtime = 'nodejs'

/**
 * POST /api/prizes/claim
 *
 * Student claims their prize by calling Payment.claim() on their Payment contract
 * This releases the funds from the Payment contract to the student's wallet
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

    const body = await request.json()
    const { attemptId } = body

    if (!attemptId) {
      return NextResponse.json(
        { success: false, error: 'Attempt ID required' },
        { status: 400 }
      )
    }

    // Get the quiz attempt with winner info
    const attempt = await prisma.quizAttempt.findUnique({
      where: { id: attemptId },
      include: {
        winner: true,
        quiz: {
          include: {
            teacher: true
          }
        },
        student: true
      }
    })

    if (!attempt) {
      return NextResponse.json(
        { success: false, error: 'Attempt not found' },
        { status: 404 }
      )
    }

    // Only the student who made the attempt can claim
    if (attempt.userId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: 'Only the student can claim their prize' },
        { status: 403 }
      )
    }

    // Must be a winner
    if (!attempt.winner) {
      return NextResponse.json(
        { success: false, error: 'This attempt did not win a prize' },
        { status: 400 }
      )
    }

    // Must have a payment contract
    if (!attempt.paymentContractRev) {
      return NextResponse.json(
        { success: false, error: 'No payment contract found for this attempt' },
        { status: 400 }
      )
    }

    console.log(`\n💰 Claiming prize for attempt ${attemptId}`)
    console.log(`Student: ${attempt.student.name}`)
    console.log(`Payment Rev: ${attempt.paymentContractRev}`)

    // Get student's Computer instance
    const studentComputer = await getUserWallet(session.user.id)

    // Sync the Payment contract
    console.log(`  📝 Syncing Payment contract...`)
    const paymentContract = await studentComputer.sync(attempt.paymentContractRev)

    if (!paymentContract) {
      return NextResponse.json(
        { success: false, error: 'Payment contract not found on blockchain' },
        { status: 404 }
      )
    }

    console.log(`  Status: ${paymentContract.status}`)
    console.log(`  Amount: ${paymentContract.amount} sats`)
    console.log(`  Locked satoshis: ${paymentContract._satoshis}`)

    if (paymentContract.status === 'claimed') {
      console.log(`  ℹ️  Payment already claimed`)
      return NextResponse.json({
        success: true,
        message: 'Prize already claimed',
        data: {
          paymentId: paymentContract._id,
          amount: paymentContract.amount.toString(),
          status: 'claimed',
          claimedAt: paymentContract.claimedAt
        }
      })
    }

    // Get quiz module specifier for encodeCall
    const quiz = attempt.quiz
    if (!quiz.moduleSpecifier) {
      return NextResponse.json(
        { success: false, error: 'Quiz module specifier not found' },
        { status: 500 }
      )
    }

    // Claim using encodeCall (like in test)
    console.log(`  🎯 Calling Payment.claim()...`)

    const { tx } = await studentComputer.encodeCall({
      target: paymentContract,
      property: 'claim',
      args: [],
      mod: quiz.moduleSpecifier
    })

    const claimTxId = await studentComputer.broadcast(tx)

    console.log(`  ✅ Claim transaction broadcast: ${claimTxId}`)

    // Wait for blockchain confirmation
    await new Promise(resolve => setTimeout(resolve, 3000))

    // Query for latest Payment revision
    const [latestPaymentRev] = await studentComputer.query({ ids: [paymentContract._id] })
    const claimedPayment = await studentComputer.sync(latestPaymentRev)

    console.log(`  Payment status after: ${claimedPayment.status}`)
    console.log(`  Payment satoshis after: ${claimedPayment._satoshis}`)

    if (claimedPayment.status !== 'claimed') {
      return NextResponse.json(
        { success: false, error: 'Payment claim did not complete successfully' },
        { status: 500 }
      )
    }

    // Update database
    await prisma.winner.update({
      where: { id: attempt.winner.id },
      data: {
        paid: true,
        paidTxHash: claimTxId
      }
    })

    console.log(`  ✅ Prize claimed successfully!`)

    return NextResponse.json({
      success: true,
      message: 'Prize claimed successfully! Funds have been released to your wallet.',
      data: {
        paymentId: claimedPayment._id,
        amount: claimedPayment.amount.toString(),
        status: 'claimed',
        claimedAt: claimedPayment.claimedAt,
        txId: claimTxId
      }
    })

  } catch (error) {
    console.error('❌ Failed to claim prize:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to claim prize'
      },
      { status: 500 }
    )
  }
}
