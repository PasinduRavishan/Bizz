/**
 * Payment Distribution Service (Custodial Model)
 *
 * This implements a custodial approach for prize distribution:
 * - Prize pool is already locked in the Quiz contract (teacher paid upfront)
 * - Entry fees are locked in QuizAttempt contracts (students paid on submission)
 * - We track ownership via database and mark prizes as awarded
 * - Funds remain in contracts (custodial model - platform holds keys)
 *
 * NOTE: The deployed Quiz contracts don't have distributePrizes method.
 * This service uses database-based accounting instead of on-chain transfers.
 */

import { prisma } from './prisma'

/**
 * Distribute prizes to winners using custodial model
 * Marks winners as paid in database and updates their earnings
 */
export async function distributePrizesToWinners(quizId: string) {
  console.log(`\n🏆 Distributing prizes (custodial model) for quiz ${quizId}`)

  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      teacher: true,
      winners: {
        where: { paid: false },
        include: {
          attempt: {
            include: {
              student: true
            }
          }
        }
      }
    }
  })

  if (!quiz) throw new Error('Quiz not found')

  if (quiz.winners.length === 0) {
    console.log('  ℹ️  No unpaid winners')
    return {
      distributed: 0,
      totalAmount: '0',
      payments: []
    }
  }

  console.log(`  Found ${quiz.winners.length} winners to pay`)
  console.log(`  Prize pool: ${quiz.prizePool} sats`)

  // Mark winners as paid in database and update their earnings
  let totalDistributed = BigInt(0)
  const paymentResults = []

  for (let i = 0; i < quiz.winners.length; i++) {
    const winner = quiz.winners[i]

    try {
      console.log(`\n  🏆 Awarding prize to winner ${i + 1}:`)
      console.log(`    Student: ${winner.attempt.student.name}`)
      console.log(`    Score: ${winner.score}%`)
      console.log(`    Prize: ${winner.prizeAmount} sats`)

      // Mark winner as paid with custodial reference
      await prisma.winner.update({
        where: { id: winner.id },
        data: {
          paid: true,
          paidTxHash: `CUSTODIAL_${quiz.contractRev}_${Date.now()}`
        }
      })

      // Update student's total earnings (accounting)
      await prisma.user.update({
        where: { id: winner.attempt.studentId },
        data: {
          totalEarnings: { increment: winner.prizeAmount }
        }
      })

      totalDistributed += winner.prizeAmount

      paymentResults.push({
        winnerId: winner.id,
        studentId: winner.attempt.studentId,
        studentAddress: winner.attempt.student.address || 'N/A',
        amount: winner.prizeAmount.toString(),
        paymentContract: `CUSTODIAL_${quiz.contractRev}`,
        status: 'success' as const
      })

      console.log(`    ✅ Prize awarded!`)

    } catch (error) {
      console.error(`  ❌ Failed to award prize to winner ${winner.id}:`, error)
      paymentResults.push({
        winnerId: winner.id,
        studentId: winner.attempt.studentId,
        studentAddress: winner.attempt.student.address || 'N/A',
        amount: winner.prizeAmount.toString(),
        paymentContract: 'FAILED',
        status: 'failed' as const
      })
    }
  }

  console.log(`\n📊 Prize Distribution Summary:`)
  console.log(`  ✅ Winners paid: ${paymentResults.filter(p => p.status === 'success').length}`)
  console.log(`  ❌ Failed: ${paymentResults.filter(p => p.status === 'failed').length}`)
  console.log(`  💰 Total distributed: ${totalDistributed} sats`)

  return {
    distributed: paymentResults.filter(p => p.status === 'success').length,
    totalAmount: totalDistributed.toString(),
    payments: paymentResults
  }
}

/**
 * Calculate entry fee distribution (custodial model)
 * Entry fees are already locked in QuizAttempt contracts
 * This calculates and records the distribution for accounting
 */
export async function payEntryFeesToTeacher(quizId: string) {
  console.log(`\n💵 Calculating entry fees (custodial model) for quiz ${quizId}`)

  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      teacher: true,
      attempts: {
        where: {
          status: { in: ['VERIFIED', 'FAILED', 'COMMITTED', 'REVEALED'] }
        },
        include: {
          student: true
        }
      }
    }
  })

  if (!quiz) throw new Error('Quiz not found')

  const attemptCount = quiz.attempts.length

  if (attemptCount === 0) {
    console.log('  ℹ️  No attempts to collect from')
    return {
      collected: 0,
      totalTeacherAmount: '0',
      totalPlatformFee: '0',
      payments: []
    }
  }

  console.log(`  Found ${attemptCount} attempts`)

  // Calculate entry fee distribution
  const totalEntryFees = quiz.entryFee * BigInt(attemptCount)
  const platformFeeAmount = BigInt(Math.floor(Number(totalEntryFees) * quiz.platformFee))
  const teacherAmount = totalEntryFees - platformFeeAmount

  console.log(`\n📊 Entry Fee Calculation:`)
  console.log(`  Attempts: ${attemptCount}`)
  console.log(`  Entry Fee per attempt: ${quiz.entryFee} sats`)
  console.log(`  Total Entry Fees: ${totalEntryFees} sats`)
  console.log(`  Platform Fee (${quiz.platformFee * 100}%): ${platformFeeAmount} sats`)
  console.log(`  Teacher Amount: ${teacherAmount} sats`)

  // In custodial model, entry fees are already in contracts
  // This is for accounting purposes - no actual transfer needed
  const payments = quiz.attempts.map(attempt => ({
    attemptId: attempt.id,
    studentId: attempt.studentId,
    teacherAmount: (quiz.entryFee - BigInt(Math.floor(Number(quiz.entryFee) * quiz.platformFee))).toString(),
    platformFee: BigInt(Math.floor(Number(quiz.entryFee) * quiz.platformFee)).toString(),
    paymentContract: `CUSTODIAL_${attempt.contractRev || 'N/A'}`,
    status: 'success' as const
  }))

  return {
    collected: attemptCount,
    totalTeacherAmount: teacherAmount.toString(),
    totalPlatformFee: platformFeeAmount.toString(),
    payments
  }
}

/**
 * Complete payment flow using custodial model
 * 1. Award prizes to winners (database accounting)
 * 2. Calculate entry fee distribution (database accounting)
 */
export async function processCompletePayments(quizId: string) {
  console.log(`\n💳 Processing complete payments (custodial model) for ${quizId}`)
  console.log(`${'='.repeat(60)}`)

  try {
    // 1. Award prizes to winners
    console.log(`\n📤 Step 1: Awarding prizes to winners...`)
    const prizeResults = await distributePrizesToWinners(quizId)

    // 2. Calculate entry fee distribution
    console.log(`\n📥 Step 2: Calculating entry fee distribution...`)
    const feeResults = await payEntryFeesToTeacher(quizId)

    // 3. Calculate net result
    const prizesDistributed = BigInt(prizeResults.totalAmount)
    const feesCollected = BigInt(feeResults.totalTeacherAmount)
    const netTeacherChange = feesCollected - prizesDistributed

    console.log(`\n💰 Financial Summary:`)
    console.log(`  Entry fees (teacher share): +${feesCollected} sats`)
    console.log(`  Prizes distributed: -${prizesDistributed} sats`)
    console.log(`  Net teacher change: ${netTeacherChange > BigInt(0) ? '+' : ''}${netTeacherChange} sats`)
    console.log(`  Platform fee earned: ${feeResults.totalPlatformFee} sats`)

    // 4. Mark quiz as completed
    await prisma.quiz.update({
      where: { id: quizId },
      data: { status: 'COMPLETED' }
    })

    // 5. Refresh balances
    await refreshBalances(quizId)

    console.log(`\n✅ Custodial payment processing complete!`)
    console.log(`${'='.repeat(60)}`)

    return {
      success: true,
      prizes: prizeResults,
      fees: feeResults,
      netTeacherChange: netTeacherChange.toString(),
      platformFee: feeResults.totalPlatformFee
    }

  } catch (error) {
    console.error(`❌ Payment processing failed:`, error)
    throw error
  }
}

/**
 * Refresh balances for all users in a quiz
 */
async function refreshBalances(quizId: string) {
  console.log(`\n🔄 Refreshing balances...`)

  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      attempts: { select: { studentId: true } }
    }
  })

  if (!quiz) return

  const userIds = new Set([quiz.teacherId, ...quiz.attempts.map(a => a.studentId)])

  const { getUserBalance } = await import('./wallet-service')

  for (const userId of userIds) {
    try {
      await getUserBalance(userId)
    } catch (error) {
      console.error(`  Failed to refresh ${userId}:`, error)
    }
  }

  console.log(`  ✅ Balances refreshed`)
}

/**
 * Claim a payment (custodial model - placeholder)
 *
 * In custodial model, funds are managed by the platform.
 * This function is a placeholder for future withdrawal functionality.
 *
 * @param userId - User claiming the payment
 * @param paymentRef - Payment reference (custodial ID)
 */
export async function claimPayment(userId: string, paymentRef: string) {
  console.log(`\n💰 Payment claim requested: ${paymentRef}`)
  console.log(`  User: ${userId}`)

  // In custodial model, prizes are already marked as paid in the database
  // The user's totalEarnings reflects their balance
  // Actual withdrawal would require platform-level withdrawal functionality

  console.log(`  ℹ️  Custodial model: Funds are managed by the platform`)
  console.log(`  ℹ️  User earnings are tracked in the database`)

  return {
    success: true,
    message: 'Custodial model - funds are tracked in your account balance',
    paymentRef
  }
}
