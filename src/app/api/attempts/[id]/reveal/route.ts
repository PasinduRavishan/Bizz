import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { verifyCommitment, decryptAttemptRevealData } from '@/lib/crypto'
import { prisma } from '@/lib/prisma'
import { getUserWallet } from '@/lib/wallet-service'

export const runtime = 'nodejs'

interface RevealAttemptRequest {
  answers?: string[]  // Optional - can be fetched from encrypted server storage
  nonce?: string      // Optional - can be fetched from encrypted server storage
}

/**
 * POST /api/attempts/[id]/reveal
 *
 * Student reveals their answers after the quiz deadline.
 * This is Phase 2 of the commit-reveal scheme.
 *
 * Flow:
 * 1. Validate the student owns this attempt
 * 2. Check the quiz deadline has passed but student reveal window is still open
 * 3. Verify the commitment hash matches answers + nonce
 * 4. Update the QuizAttempt contract on blockchain
 * 5. Update the database
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: attemptId } = await params

    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body: RevealAttemptRequest = await request.json()

    // Find the attempt in database first (we may need to decrypt reveal data)
    const attempt = await prisma.quizAttempt.findFirst({
      where: {
        OR: [
          { id: attemptId },
          { contractId: attemptId }
        ]
      },
      include: {
        quiz: true,
        student: true
      }
    })

    if (!attempt) {
      return NextResponse.json(
        { success: false, error: 'Attempt not found' },
        { status: 404 }
      )
    }

    // Verify the student owns this attempt
    if (attempt.studentId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: 'You can only reveal your own attempts' },
        { status: 403 }
      )
    }

    // Check attempt status
    if (attempt.status !== 'COMMITTED') {
      return NextResponse.json(
        { success: false, error: `Attempt already ${attempt.status.toLowerCase()}. Cannot reveal again.` },
        { status: 400 }
      )
    }

    // Check timing - quiz deadline must have passed
    const now = new Date()
    if (now < attempt.quiz.deadline) {
      return NextResponse.json(
        { success: false, error: 'Quiz deadline has not passed yet. Please wait until the deadline.' },
        { status: 400 }
      )
    }

    // Check student reveal deadline hasn't passed
    if (now > attempt.quiz.studentRevealDeadline) {
      // Mark as failed in database
      await prisma.quizAttempt.update({
        where: { id: attempt.id },
        data: { status: 'FAILED' }
      })
      return NextResponse.json(
        { success: false, error: 'Student reveal deadline has passed. Your attempt is now marked as failed.' },
        { status: 400 }
      )
    }

    // Get answers and nonce - either from request body or decrypt from server storage
    let answers: string[]
    let nonce: string

    if (body.answers && body.nonce) {
      // Client provided answers and nonce (legacy/fallback)
      answers = body.answers
      nonce = body.nonce
    } else {
      // Fetch from encrypted server storage (production approach)
      const REVEAL_DATA_KEY = process.env.REVEAL_DATA_KEY || process.env.WALLET_ENCRYPTION_KEY
      if (!REVEAL_DATA_KEY) {
        return NextResponse.json(
          { success: false, error: 'Server configuration error: REVEAL_DATA_KEY not set' },
          { status: 500 }
        )
      }

      // Access the attempt with encryptedRevealData field
      const attemptWithEncrypted = attempt as typeof attempt & { encryptedRevealData?: string }

      if (!attemptWithEncrypted.encryptedRevealData) {
        return NextResponse.json(
          { success: false, error: 'Reveal data not found. Please provide answers and nonce manually.' },
          { status: 400 }
        )
      }

      try {
        const decryptedData = decryptAttemptRevealData(attemptWithEncrypted.encryptedRevealData, REVEAL_DATA_KEY)
        answers = decryptedData.answers
        nonce = decryptedData.nonce
        console.log('🔐 Decrypted reveal data from server storage')
      } catch (decryptError) {
        console.error('Failed to decrypt reveal data:', decryptError)
        return NextResponse.json(
          { success: false, error: 'Failed to decrypt reveal data. Please provide answers and nonce manually.' },
          { status: 500 }
        )
      }
    }

    // Verify commitment matches
    const isValidCommitment = verifyCommitment(answers, nonce, attempt.answerCommitment)
    if (!isValidCommitment) {
      return NextResponse.json(
        { success: false, error: 'Invalid commitment. The answers and nonce do not match the original commitment.' },
        { status: 400 }
      )
    }

    console.log('🔓 Revealing student attempt...')
    console.log('  Attempt ID:', attempt.id)
    console.log('  Contract Rev:', attempt.contractRev)
    console.log('  Student:', session.user.id)

    // Get student's wallet to call reveal on blockchain
    const computer = await getUserWallet(session.user.id)

    console.log('📝 Syncing attempt contract from blockchain...')

    // Sync the attempt contract from blockchain
    const attemptContract = await computer.sync(attempt.contractRev)

    if (!attemptContract) {
      console.error('❌ Failed to sync contract from blockchain')
      return NextResponse.json(
        { success: false, error: 'Failed to sync attempt contract from blockchain. Please try again.' },
        { status: 500 }
      )
    }

    console.log('✅ Contract synced, calling reveal method...')
    console.log('  Contract status:', attemptContract.status)

    // Call reveal method on contract (Bitcoin Computer pattern: direct call)
    // This mutates the contract state on-chain
    attemptContract.reveal(answers, nonce)
    
    console.log('✅ Reveal method called, waiting for mutation to complete...')
    
    // Wait a moment for the mutation to process
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Sync again to get updated state
    const updatedContract = await computer.sync(attempt.contractRev)
    console.log('✅ Contract updated! Status:', updatedContract.status)
    console.log('  Revealed answers:', updatedContract.revealedAnswers)
    
    // Get the transaction ID from the contract's _rev
    const txId = updatedContract._rev.split('_')[0]

    // Update database
    await prisma.quizAttempt.update({
      where: { id: attempt.id },
      data: {
        status: 'REVEALED',
        revealedAnswers: answers,
        nonce: nonce,
        revealTimestamp: new Date(),
        contractRev: updatedContract._rev
      }
    })

    console.log('💾 Database updated with revealed answers')

    return NextResponse.json({
      success: true,
      message: 'Answers revealed successfully',
      data: {
        attemptId: attempt.id,
        contractRev: updatedContract._rev,
        txId: txId,
        status: 'REVEALED',
        revealTimestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('❌ Failed to reveal attempt:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to reveal answers'
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/attempts/[id]/reveal
 *
 * Get reveal status and requirements for an attempt.
 * Helps the UI know if reveal is possible and what's needed.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: attemptId } = await params

    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Find the attempt
    const attempt = await prisma.quizAttempt.findFirst({
      where: {
        OR: [
          { id: attemptId },
          { contractId: attemptId }
        ]
      },
      include: {
        quiz: {
          select: {
            id: true,
            title: true,
            deadline: true,
            studentRevealDeadline: true,
            teacherRevealDeadline: true,
            status: true,
            questionCount: true
          }
        }
      }
    })

    if (!attempt) {
      return NextResponse.json(
        { success: false, error: 'Attempt not found' },
        { status: 404 }
      )
    }

    // Verify ownership
    if (attempt.studentId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: 'You can only view your own attempts' },
        { status: 403 }
      )
    }

    const now = new Date()
    const canReveal =
      attempt.status === 'COMMITTED' &&
      now >= attempt.quiz.deadline &&
      now <= attempt.quiz.studentRevealDeadline

    const revealInfo = {
      attemptId: attempt.id,
      contractId: attempt.contractId,
      status: attempt.status,
      quizTitle: attempt.quiz.title,
      quizDeadline: attempt.quiz.deadline.toISOString(),
      studentRevealDeadline: attempt.quiz.studentRevealDeadline.toISOString(),
      canReveal,
      isRevealed: attempt.status !== 'COMMITTED',
      revealedAnswers: attempt.status !== 'COMMITTED' ? attempt.revealedAnswers : null,
      revealTimestamp: attempt.revealTimestamp?.toISOString() || null,
      reason: !canReveal ? getRevealBlockReason(attempt, now) : null
    }

    return NextResponse.json({
      success: true,
      data: revealInfo
    })

  } catch (error) {
    console.error('Failed to get reveal status:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to get reveal status' },
      { status: 500 }
    )
  }
}

function getRevealBlockReason(
  attempt: { status: string; quiz: { deadline: Date; studentRevealDeadline: Date } },
  now: Date
): string {
  if (attempt.status !== 'COMMITTED') {
    return `Attempt already ${attempt.status.toLowerCase()}`
  }
  if (now < attempt.quiz.deadline) {
    return 'Quiz deadline has not passed yet'
  }
  if (now > attempt.quiz.studentRevealDeadline) {
    return 'Student reveal deadline has passed'
  }
  return 'Unknown reason'
}
