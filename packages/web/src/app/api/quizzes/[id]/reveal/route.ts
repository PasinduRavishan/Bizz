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

    // Check timing - quiz deadline must have passed
    const now = new Date()
    if (now < quiz.deadline) {
      const remainingTime = Math.ceil((quiz.deadline.getTime() - now.getTime()) / (1000 * 60))
      return NextResponse.json(
        {
          success: false,
          error: `Quiz is still active. Please wait ${remainingTime} minutes after the deadline to reveal answers.`
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

    console.log('✅ Contract synced')
    console.log('  Current status:', quizContract.status)
    console.log('  Current rev:', quizContract._rev)

    // Call revealAnswers method using encodeCall pattern
    console.log('🔓 Calling revealAnswers method on contract...')

    if (!quiz.moduleSpecifier) {
      return NextResponse.json(
        { success: false, error: 'Quiz module specifier not found. Cannot call reveal method.' },
        { status: 500 }
      )
    }

    let updatedRev: string
    let txId: string

    try {
      // Use encodeCall pattern to properly persist blockchain changes
      const { tx, effect } = await computer.encodeCall({
        target: quizContract,
        property: 'revealAnswers',
        args: [answers, salt],
        mod: quiz.moduleSpecifier
      })

      // Broadcast the transaction to blockchain
      await computer.broadcast(tx)

      console.log('✅ RevealAnswers transaction broadcasted')
      console.log('  Waiting 3 seconds for blockchain confirmation...')

      // Wait for blockchain confirmation
      await new Promise(resolve => setTimeout(resolve, 3000))

      // Query for latest revision and sync
      const [latestRev] = await computer.query({ ids: [quiz.contractId] })
      const updatedContract = await computer.sync(latestRev)

      console.log('✅ Contract synced after reveal')
      console.log('  New status:', updatedContract.status)
      console.log('  Revealed answers stored:', updatedContract.revealedAnswers ? 'yes' : 'no')

      updatedRev = updatedContract._rev
      txId = updatedRev.split(':')[0]

      console.log('✅ Contract updated!')
      console.log('  New rev:', updatedRev)
      console.log('  Transaction ID:', txId)
      console.log('  New status:', updatedContract.status)
    } catch (revealError) {
      console.error('❌ RevealAnswers method failed:', revealError)
      throw new Error(`Failed to call revealAnswers on contract: ${revealError instanceof Error ? revealError.message : 'Unknown error'}`)
    }

    // Update database
    await prisma.quiz.update({
      where: { id: quiz.id },
      data: {
        status: 'REVEALED',
        revealedAnswers: answers,
        salt: salt,
        contractRev: updatedRev
      }
    })

    console.log('💾 Database updated with revealed answers')

    // Calculate scores for all revealed attempts
    const scoringResults = await calculateAndUpdateScores(quiz.id, answers)

    // Process payments: distribute prizes to winners using contract methods
    // Pass the UPDATED revision (with status 'revealed') to payment distribution
    // Payment distribution will poll for confirmed 'revealed' status
    console.log('\n💰 Processing prize distribution via contracts...')

    let paymentResults
    try {
      const { processCompletePayments } = await import('@/lib/payment-distribution')
      // Pass updatedRev so payment distribution uses the REVEALED quiz contract
      paymentResults = await processCompletePayments(quiz.id, updatedRev)
      console.log('✅ Complete payment processing done!')
    } catch (paymentError) {
      console.error('⚠️ Payment processing failed:', paymentError)
      // Don't fail the reveal - payments can be retried
      paymentResults = {
        success: false,
        error: paymentError instanceof Error ? paymentError.message : 'Payment processing failed'
      }
    }

    // Helper function to convert BigInt to string for JSON serialization
    const convertBigIntToString = (obj: any): any => {
      if (obj === null || obj === undefined) return obj
      if (typeof obj === 'bigint') return obj.toString()
      if (Array.isArray(obj)) return obj.map(convertBigIntToString)
      if (typeof obj === 'object') {
        const converted: any = {}
        for (const key in obj) {
          converted[key] = convertBigIntToString(obj[key])
        }
        return converted
      }
      return obj
    }

    return NextResponse.json({
      success: true,
      message: 'Quiz answers revealed successfully',
      data: {
        quizId: quiz.id,
        contractRev: updatedRev,
        txId: txId,
        status: 'REVEALED',
        revealTimestamp: new Date().toISOString(),
        scoringResults: convertBigIntToString(scoringResults),
        paymentResults: convertBigIntToString(paymentResults)
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
 * Calculate and update scores for all committed attempts
 * This auto-scores attempts by decrypting their answers from server storage
 */
async function calculateAndUpdateScores(quizId: string, correctAnswers: string[]) {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      attempts: {
        where: { status: 'COMMITTED' }  // Process COMMITTED attempts (no student reveal needed)
      }
    }
  })

  if (!quiz) {
    return { processed: 0, passed: 0, failed: 0 }
  }

  let passed = 0
  let failed = 0

  // Get decryption key for server-side encrypted answers
  const REVEAL_DATA_KEY = process.env.REVEAL_DATA_KEY || process.env.WALLET_ENCRYPTION_KEY
  if (!REVEAL_DATA_KEY) {
    console.error('❌ REVEAL_DATA_KEY not configured - cannot decrypt student answers')
    return { processed: 0, passed: 0, failed: 0 }
  }

  const { decryptAttemptRevealData, verifyCommitment } = await import('@/lib/crypto')

  for (const attempt of quiz.attempts) {
    try {
      // Access the attempt with encryptedRevealData field
      const attemptWithEncrypted = attempt as typeof attempt & { encryptedRevealData?: string }

      if (!attemptWithEncrypted.encryptedRevealData) {
        console.log(`  ⚠️ Attempt ${attempt.id}: No encrypted reveal data - marking as FAILED`)
        await prisma.quizAttempt.update({
          where: { id: attempt.id },
          data: { status: 'FAILED' }
        })
        failed++
        continue
      }

      // Decrypt the student's answers from server storage
      const { answers, nonce } = decryptAttemptRevealData(
        attemptWithEncrypted.encryptedRevealData,
        REVEAL_DATA_KEY
      )

      // Verify the commitment hash matches (prevents tampering)
      if (!verifyCommitment(answers, nonce, attempt.answerCommitment)) {
        console.log(`  ❌ Attempt ${attempt.id}: Commitment verification FAILED - marking as FAILED`)
        await prisma.quizAttempt.update({
          where: { id: attempt.id },
          data: { status: 'FAILED' }
        })
        failed++
        continue
      }

      // Calculate score
      let correctCount = 0
      for (let i = 0; i < correctAnswers.length; i++) {
        if (answers[i] === correctAnswers[i]) {
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

      // Update attempt with score and revealed data
      await prisma.quizAttempt.update({
        where: { id: attempt.id },
        data: {
          score,
          passed: didPass,
          status: 'VERIFIED',
          revealedAnswers: answers,  // Store decrypted answers
          nonce: nonce,
          revealTimestamp: new Date()
        }
      })

      console.log(`  📊 Attempt ${attempt.id}: Score ${score}% - ${didPass ? 'PASSED' : 'FAILED'}`)

    } catch (decryptError) {
      console.error(`  ❌ Failed to decrypt/score attempt ${attempt.id}:`, decryptError)
      await prisma.quizAttempt.update({
        where: { id: attempt.id },
        data: { status: 'FAILED' }
      })
      failed++
    }
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
      now >= quiz.deadline &&
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
  quiz: { status: string; deadline: Date; teacherRevealDeadline: Date },
  now: Date,
  isOwner: boolean
): string {
  if (!isOwner) {
    return 'Only the quiz owner can reveal answers'
  }
  if (quiz.status !== 'ACTIVE') {
    return `Quiz already ${quiz.status.toLowerCase()}`
  }
  if (now < quiz.deadline) {
    return 'Quiz is still active - wait for deadline'
  }
  if (now > quiz.teacherRevealDeadline) {
    return 'Teacher reveal deadline has passed'
  }
  return 'Unknown reason'
}
