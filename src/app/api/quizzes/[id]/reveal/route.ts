import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { verifyAnswerHash, decryptQuizRevealData } from '@/lib/crypto'
import { prisma } from '@/lib/prisma'
import { getUserWallet } from '@/lib/wallet-service'

export const runtime = 'nodejs'

interface RevealQuizRequest {
  answers?: string[]  // Optional - can be fetched from encrypted server storage
  salt?: string       // Optional - can be fetched from encrypted server storage
}

/**
 * POST /api/quizzes/[id]/reveal
 *
 * Teacher reveals the correct answers after student reveal window closes.
 * This triggers the verification phase where student scores are calculated.
 *
 * Flow:
 * 1. Validate the teacher owns this quiz
 * 2. Check the student reveal deadline has passed
 * 3. Verify the answer hashes match
 * 4. Update the Quiz contract on blockchain
 * 5. Update the database
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: quizId } = await params

    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (session.user.role !== 'TEACHER') {
      return NextResponse.json(
        { success: false, error: 'Only teachers can reveal quiz answers' },
        { status: 403 }
      )
    }

    // Find the quiz in database first (we need to decrypt reveal data)
    const quiz = await prisma.quiz.findFirst({
      where: {
        OR: [
          { id: quizId },
          { contractId: quizId }
        ]
      },
      include: {
        teacher: true,
        attempts: {
          where: {
            status: 'REVEALED'
          }
        }
      }
    })

    if (!quiz) {
      return NextResponse.json(
        { success: false, error: 'Quiz not found' },
        { status: 404 }
      )
    }

    // Verify the teacher owns this quiz
    if (quiz.teacherId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: 'You can only reveal answers for your own quizzes' },
        { status: 403 }
      )
    }

    // Check quiz status
    if (quiz.status !== 'ACTIVE') {
      return NextResponse.json(
        { success: false, error: `Quiz is already ${quiz.status.toLowerCase()}. Cannot reveal again.` },
        { status: 400 }
      )
    }

    // Check timing - student reveal deadline must have passed
    const now = new Date()
    if (now < quiz.studentRevealDeadline) {
      const remainingTime = Math.ceil((quiz.studentRevealDeadline.getTime() - now.getTime()) / (1000 * 60))
      return NextResponse.json(
        {
          success: false,
          error: `Student reveal window is still open. Please wait ${remainingTime} minutes before revealing answers.`
        },
        { status: 400 }
      )
    }

    // Check teacher reveal deadline hasn't passed
    if (now > quiz.teacherRevealDeadline) {
      return NextResponse.json(
        { success: false, error: 'Teacher reveal deadline has passed. Quiz will be refunded to students.' },
        { status: 400 }
      )
    }

    // Get answers and salt from encrypted server storage
    const REVEAL_DATA_KEY = process.env.REVEAL_DATA_KEY || process.env.WALLET_ENCRYPTION_KEY
    if (!REVEAL_DATA_KEY) {
      return NextResponse.json(
        { success: false, error: 'Server configuration error: REVEAL_DATA_KEY not set' },
        { status: 500 }
      )
    }

    const quizWithEncrypted = quiz as typeof quiz & { encryptedRevealData?: string }

    if (!quizWithEncrypted.encryptedRevealData) {
      return NextResponse.json(
        { success: false, error: 'Reveal data not found. Quiz may be corrupted.' },
        { status: 400 }
      )
    }

    let answers: string[]
    let salt: string

    try {
      const decryptedData = decryptQuizRevealData(quizWithEncrypted.encryptedRevealData, REVEAL_DATA_KEY)
      answers = decryptedData.answers
      salt = decryptedData.salt
      console.log('🔐 Decrypted reveal data from server storage')
    } catch (decryptError) {
      console.error('Failed to decrypt reveal data:', decryptError)
      return NextResponse.json(
        { success: false, error: 'Failed to decrypt reveal data. Server configuration issue.' },
        { status: 500 }
      )
    }

    // Verify answer count matches
    if (answers.length !== quiz.questionCount) {
      return NextResponse.json(
        { success: false, error: `Expected ${quiz.questionCount} answers, got ${answers.length}` },
        { status: 400 }
      )
    }

    // Verify each answer hash matches
    const quizIdForHashing = quiz.hashingQuizId || quiz.contractId // Use stored hashingQuizId or fallback to contractId
    for (let i = 0; i < answers.length; i++) {
      const isValid = verifyAnswerHash(
        quizIdForHashing,
        i,
        answers[i],
        salt,
        quiz.answerHashes[i]
      )
      if (!isValid) {
        return NextResponse.json(
          { success: false, error: `Answer hash mismatch at index ${i}. Reveal data may be corrupted.` },
          { status: 400 }
        )
      }
    }

    console.log('🔓 Revealing quiz answers...')
    console.log('  Quiz ID:', quiz.id)
    console.log('  Contract Rev:', quiz.contractRev)
    console.log('  Teacher:', session.user.id)
    console.log('  Revealed attempts waiting:', quiz.attempts.length)

    // Get teacher's wallet to call reveal on blockchain
    const computer = await getUserWallet(session.user.id)

    console.log('📝 Syncing quiz contract from blockchain...')

    // Sync the quiz contract from blockchain
    const quizContract = await computer.sync(quiz.contractRev)

    if (!quizContract) {
      console.error('❌ Failed to sync contract from blockchain')
      return NextResponse.json(
        { success: false, error: 'Failed to sync quiz contract from blockchain. Please try again.' },
        { status: 500 }
      )
    }

    console.log('✅ Contract synced, calling revealAnswers method...')
    console.log('  Contract status:', quizContract.status)

    // Call revealAnswers method on contract (Bitcoin Computer pattern: direct call)
    // This mutates the contract state on-chain
    quizContract.revealAnswers(answers, salt)
    
    console.log('✅ RevealAnswers method called, waiting for mutation to complete...')
    
    // Wait a moment for the mutation to process
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Sync again to get updated state
    const updatedContract = await computer.sync(quiz.contractRev)
    console.log('✅ Contract updated! Status:', updatedContract.status)
    console.log('  Revealed answers:', updatedContract.revealedAnswers)
    
    // Get the transaction ID from the contract's _rev
    const txId = updatedContract._rev.split('_')[0]

    // Update database
    await prisma.quiz.update({
      where: { id: quiz.id },
      data: {
        status: 'REVEALED',
        revealedAnswers: answers,
        salt: salt,
        contractRev: updatedContract._rev
      }
    })

    console.log('💾 Database updated with revealed answers')

    // Calculate scores for all revealed attempts
    const scoringResults = await calculateAndUpdateScores(quiz.id, answers)

    return NextResponse.json({
      success: true,
      message: 'Quiz answers revealed successfully',
      data: {
        quizId: quiz.id,
        contractRev: updatedContract._rev,
        txId: txId,
        status: 'REVEALED',
        revealTimestamp: new Date().toISOString(),
        scoringResults
      }
    })

  } catch (error) {
    console.error('❌ Failed to reveal quiz:', error)
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
 * Calculate and update scores for all revealed attempts
 */
async function calculateAndUpdateScores(quizId: string, correctAnswers: string[]) {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      attempts: {
        where: { status: 'REVEALED' }
      }
    }
  })

  if (!quiz) {
    return { processed: 0, passed: 0, failed: 0 }
  }

  let passed = 0
  let failed = 0

  for (const attempt of quiz.attempts) {
    if (!attempt.revealedAnswers || attempt.revealedAnswers.length === 0) {
      continue
    }

    // Calculate score
    let correctCount = 0
    for (let i = 0; i < correctAnswers.length; i++) {
      if (attempt.revealedAnswers[i] === correctAnswers[i]) {
        correctCount++
      }
    }

    const score = Math.round((correctCount / correctAnswers.length) * 100)
    const didPass = score >= quiz.passThreshold

    if (didPass) {
      passed++
    } else {
      failed++
    }

    // Update attempt with score
    await prisma.quizAttempt.update({
      where: { id: attempt.id },
      data: {
        score,
        passed: didPass,
        status: 'VERIFIED'
      }
    })

    console.log(`  📊 Attempt ${attempt.id}: Score ${score}% - ${didPass ? 'PASSED' : 'FAILED'}`)
  }

  // Create winner records for those who passed
  if (passed > 0) {
    const passedAttempts = await prisma.quizAttempt.findMany({
      where: {
        quizId,
        status: 'VERIFIED',
        passed: true
      }
    })

    // Calculate prize per winner
    const prizePerWinner = quiz.prizePool / BigInt(passed)

    for (const attempt of passedAttempts) {
      await prisma.winner.create({
        data: {
          quizId,
          attemptId: attempt.id,
          score: attempt.score || 0,
          prizeAmount: prizePerWinner
        }
      })
    }

    console.log(`  🏆 Created ${passed} winner records, ${prizePerWinner} sats each`)
  }

  return {
    processed: quiz.attempts.length,
    passed,
    failed
  }
}

/**
 * GET /api/quizzes/[id]/reveal
 *
 * Get reveal status and requirements for a quiz.
 * Helps the UI know if reveal is possible and what's needed.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: quizId } = await params

    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Find the quiz
    const quiz = await prisma.quiz.findFirst({
      where: {
        OR: [
          { id: quizId },
          { contractId: quizId }
        ]
      },
      include: {
        attempts: {
          select: {
            id: true,
            status: true
          }
        }
      }
    })

    if (!quiz) {
      return NextResponse.json(
        { success: false, error: 'Quiz not found' },
        { status: 404 }
      )
    }

    // Verify ownership for sensitive data
    const isOwner = quiz.teacherId === session.user.id

    const now = new Date()
    const canReveal =
      isOwner &&
      quiz.status === 'ACTIVE' &&
      now >= quiz.studentRevealDeadline &&
      now <= quiz.teacherRevealDeadline

    const attemptStats = {
      total: quiz.attempts.length,
      committed: quiz.attempts.filter(a => a.status === 'COMMITTED').length,
      revealed: quiz.attempts.filter(a => a.status === 'REVEALED').length,
      verified: quiz.attempts.filter(a => a.status === 'VERIFIED').length,
      failed: quiz.attempts.filter(a => a.status === 'FAILED').length
    }

    const revealInfo = {
      quizId: quiz.id,
      contractId: quiz.contractId,
      status: quiz.status,
      title: quiz.title,
      questionCount: quiz.questionCount,
      deadline: quiz.deadline.toISOString(),
      studentRevealDeadline: quiz.studentRevealDeadline.toISOString(),
      teacherRevealDeadline: quiz.teacherRevealDeadline.toISOString(),
      canReveal,
      isRevealed: quiz.status !== 'ACTIVE',
      revealedAnswers: quiz.status !== 'ACTIVE' && isOwner ? quiz.revealedAnswers : null,
      reason: !canReveal ? getRevealBlockReason(quiz, now, isOwner) : null,
      attemptStats,
      // Only return salt to the owner for reveal
      salt: isOwner ? quiz.salt : null
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
  quiz: { status: string; studentRevealDeadline: Date; teacherRevealDeadline: Date },
  now: Date,
  isOwner: boolean
): string {
  if (!isOwner) {
    return 'Only the quiz owner can reveal answers'
  }
  if (quiz.status !== 'ACTIVE') {
    return `Quiz already ${quiz.status.toLowerCase()}`
  }
  if (now < quiz.studentRevealDeadline) {
    return 'Student reveal window is still open'
  }
  if (now > quiz.teacherRevealDeadline) {
    return 'Teacher reveal deadline has passed'
  }
  return 'Unknown reason'
}
