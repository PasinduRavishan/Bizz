/**
 * Payment Service
 * 
 * Handles prize distribution accounting for the quiz platform.
 * 
 * ARCHITECTURE:
 * - Prize pool is locked in Quiz contract when teacher creates quiz (teacher already paid)
 * - Entry fees are locked in QuizAttempt contracts when students submit (students already paid)
 * - We track ownership and update database balances
 * - Funds stay in contracts (Bitcoin Computer custodial model)
 */

import { prisma } from './prisma'
import { getUserBalance } from './wallet-service'

/**
 * Award prizes to winners by marking them as paid
 * Prize pool is already locked in Quiz contract
 * 
 * @param quizId - Quiz ID to distribute prizes for
 * @returns Distribution results
 */
export async function awardPrizes(quizId: string) {
  console.log(`\n💰 Awarding prizes for quiz ${quizId}`)
  
  const winners = await prisma.winner.findMany({
    where: { 
      quizId,
      paid: false 
    },
    include: {
      attempt: {
        include: {
          student: true
        }
      }
    }
  })

  if (winners.length === 0) {
    console.log('  No unpaid winners found')
    return {
      distributed: 0,
      failed: 0,
      totalAmount: '0',
      transactions: []
    }
  }

  console.log(`  Found ${winners.length} winners to award`)

  const results = {
    distributed: 0,
    failed: 0,
    totalAmount: BigInt(0),
    transactions: [] as Array<{ winnerId: string; userId: string; amount: string; status: string }>
  }

  for (const winner of winners) {
    try {
      console.log(`\n🏆 Awarding prize to winner ${winner.id}:`)
      console.log(`  Student: ${winner.attempt.student.name}`)
      console.log(`  Score: ${winner.score}%`)
      console.log(`  Prize: ${winner.prizeAmount} sats`)

      // Mark winner as paid
      await prisma.winner.update({
        where: { id: winner.id },
        data: {
          paid: true,
          paidTxHash: `CUSTODIAL_${Date.now()}` // Custodial model - prize in contract
        }
      })

      // Update student's total earnings (accounting only)
      await prisma.user.update({
        where: { id: winner.attempt.userId },
        data: {
          totalEarnings: {
            increment: winner.prizeAmount
          }
        }
      })

      results.distributed++
      results.totalAmount += winner.prizeAmount
      results.transactions.push({
        winnerId: winner.id,
        userId: winner.attempt.userId,
        amount: winner.prizeAmount.toString(),
        status: 'awarded'
      })

      console.log(`✅ Prize awarded!`)
      
    } catch (error) {
      console.error(`❌ Failed to award prize to winner ${winner.id}:`, error)
      results.failed++
      results.transactions.push({
        winnerId: winner.id,
        userId: winner.attempt.userId,
        amount: winner.prizeAmount.toString(),
        status: 'failed'
      })
    }
  }

  console.log(`\n📊 Prize Award Summary:`)
  console.log(`  ✅ Awarded: ${results.distributed}`)
  console.log(`  ❌ Failed: ${results.failed}`)
  console.log(`  💰 Total Amount: ${results.totalAmount} sats`)
  
  // Convert BigInt to string for JSON serialization
  return {
    ...results,
    totalAmount: results.totalAmount.toString()
  }
}

/**
 * Calculate entry fee distribution
 * Entry fees are locked in QuizAttempt contracts
 * 
 * @param quizId - Quiz ID
 * @returns Fee calculation results
 */
export async function calculateEntryFees(quizId: string) {
  console.log(`\n💵 Calculating entry fees for quiz ${quizId}`)
  
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      attempts: {
        where: {
          status: { in: ['COMMITTED', 'REVEALED', 'VERIFIED'] }
        }
      }
    }
  })

  if (!quiz) {
    throw new Error('Quiz not found')
  }

  const attemptCount = quiz.attempts.length
  const totalEntryFees = quiz.entryFee * BigInt(attemptCount)
  const platformFeePercent = quiz.platformFee
  const platformFeeAmount = BigInt(Math.floor(Number(totalEntryFees) * platformFeePercent))
  const teacherAmount = totalEntryFees - platformFeeAmount

  console.log(`📊 Entry Fee Calculation:`)
  console.log(`  Attempts: ${attemptCount}`)
  console.log(`  Entry Fee: ${quiz.entryFee} sats`)
  console.log(`  Total Entry Fees: ${totalEntryFees} sats`)
  console.log(`  Platform Fee (${platformFeePercent * 100}%): ${platformFeeAmount} sats`)
  console.log(`  Teacher Amount: ${teacherAmount} sats`)

  // Note: Entry fees are already locked in QuizAttempt contracts
  // This is for accounting purposes
  
  return {
    attemptCount,
    totalEntryFees: totalEntryFees.toString(),
    platformFeeAmount: platformFeeAmount.toString(),
    teacherAmount: teacherAmount.toString()
  }
}

/**
 * Refresh wallet balances for all users involved in a quiz
 * 
 * @param quizId - Quiz ID
 */
export async function refreshQuizBalances(quizId: string) {
  console.log(`\n🔄 Refreshing balances for quiz ${quizId}`)
  
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      teacher: true,
      attempts: {
        include: {
          student: true
        }
      }
    }
  })

  if (!quiz) {
    throw new Error('Quiz not found')
  }

  const usersToUpdate = new Set<string>()
  usersToUpdate.add(quiz.teacherId)
  
  for (const attempt of quiz.attempts) {
    usersToUpdate.add(attempt.userId)
  }

  console.log(`  Updating ${usersToUpdate.size} user balances...`)

  for (const userId of usersToUpdate) {
    try {
      const balance = await getUserBalance(userId)
      console.log(`  ✅ User ${userId}: ${balance.toString()} sats`)
    } catch (error) {
      console.error(`  ❌ Failed to update user ${userId}:`, error)
    }
  }

  console.log(`\n✅ Balance refresh complete`)
}

/**
 * Process all quiz payments after teacher reveals
 * 
 * @param quizId - Quiz ID
 * @returns Complete payment results
 */
export async function processQuizPayments(quizId: string) {
  console.log(`\n💳 Processing quiz payments for ${quizId}`)
  console.log(`${'='.repeat(50)}`)

  // Award prizes to winners
  const prizeResults = await awardPrizes(quizId)

  // Calculate entry fee distribution (for records)
  const feeResults = await calculateEntryFees(quizId)

  // Refresh all user balances
  await refreshQuizBalances(quizId)

  // Mark quiz as completed if all prizes awarded
  if (prizeResults.distributed > 0 && prizeResults.failed === 0) {
    await prisma.quiz.update({
      where: { id: quizId },
      data: { status: 'COMPLETED' }
    })
    console.log(`\n✅ Quiz ${quizId} marked as COMPLETED`)
  }

  console.log(`\n✅ Payment processing complete!`)
  console.log(`${'='.repeat(50)}`)

  return {
    prizes: prizeResults,
    fees: feeResults
  }
}
