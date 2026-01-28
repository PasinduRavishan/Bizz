/**
 * Payment Service - Prize Distribution & Fee Transfers
 * 
 * Handles all payment operations for the quiz platform:
 * - Prize distribution to winners
 * - Entry fee transfers to teachers
 * - Platform fee collection
 * - Balance updates
 */

import { prisma } from './prisma'
import { getUserWallet, getUserBalance } from './wallet-service'

/**
 * Send payment from one user to another
 * 
 * @param fromUserId - Sender user ID
 * @param toAddress - Recipient address
 * @param amountSats - Amount in satoshis
 * @param description - Transaction description
 * @returns Transaction hash
 */
export async function sendPayment(
  fromUserId: string,
  toAddress: string,
  amountSats: bigint,
  description: string
): Promise<string> {
  const computer = await getUserWallet(fromUserId)
  
  // Check balance
  const { balance } = await computer.getBalance()
  const requiredBalance = amountSats + BigInt(50000) // Add gas buffer
  
  if (balance < requiredBalance) {
    throw new Error(
      `Insufficient balance. Have ${balance} sats, need ${requiredBalance} sats (${amountSats} + 50k gas)`
    )
  }

  // Convert satoshis to BTC for Bitcoin Computer
  const amountBTC = Number(amountSats) / 1e8
  
  console.log(`💸 Sending payment:`)
  console.log(`  From: ${fromUserId}`)
  console.log(`  To: ${toAddress}`)
  console.log(`  Amount: ${amountSats} sats (${amountBTC} BTC)`)
  console.log(`  Description: ${description}`)

  // Send payment
  const txId = await computer.send(toAddress, amountBTC)
  
  console.log(`✅ Payment sent! TX: ${txId}`)
  
  // Update sender balance
  await getUserBalance(fromUserId)
  
  return txId
}

/**
 * Distribute prizes to all winners of a quiz
 * 
 * @param quizId - Quiz ID to distribute prizes for
 * @returns Distribution results with transaction hashes
 */
export async function distributePrizes(quizId: string) {
  console.log(`\n💰 Starting prize distribution for quiz ${quizId}`)
  
  // Get quiz with teacher info
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      teacher: true,
      winners: {
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

  if (!quiz) {
    throw new Error('Quiz not found')
  }

  if (quiz.status !== 'REVEALED') {
    throw new Error('Quiz must be in REVEALED status to distribute prizes')
  }

  if (!quiz.winners || quiz.winners.length === 0) {
    console.log('⚠️ No winners to distribute prizes to')
    return { distributed: 0, totalAmount: BigInt(0), transactions: [] }
  }

  const results = {
    distributed: 0,
    failed: 0,
    totalAmount: BigInt(0),
    transactions: [] as Array<{ winnerId: string; studentAddress: string; amount: bigint; txHash: string }>
  }

  // Distribute prize to each winner
  for (const winner of quiz.winners) {
    if (winner.paid) {
      console.log(`⏭️ Winner ${winner.id} already paid, skipping`)
      continue
    }

    const studentAddress = winner.attempt.student.address
    if (!studentAddress) {
      console.error(`❌ Winner ${winner.id} has no wallet address, skipping`)
      results.failed++
      continue
    }

    try {
      console.log(`\n📤 Paying winner ${winner.id}:`)
      console.log(`  Student: ${winner.attempt.student.name} (${studentAddress})`)
      console.log(`  Score: ${winner.score}%`)
      console.log(`  Prize: ${winner.prizeAmount} sats`)

      // Send prize from teacher's wallet to student
      const txHash = await sendPayment(
        quiz.teacherId,
        studentAddress,
        winner.prizeAmount,
        `Prize from quiz ${quiz.title || quiz.id}`
      )

      // Mark as paid
      await prisma.winner.update({
        where: { id: winner.id },
        data: {
          paid: true,
          paidTxHash: txHash
        }
      })

      // Update student's total earnings
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
        studentAddress,
        amount: winner.prizeAmount,
        txHash
      })

      console.log(`✅ Prize paid successfully!`)
      
    } catch (error) {
      console.error(`❌ Failed to pay winner ${winner.id}:`, error)
      results.failed++
    }
  }

  // Update quiz status to completed after all prizes distributed
  if (results.distributed === quiz.winners.length) {
    await prisma.quiz.update({
      where: { id: quizId },
      data: { status: 'COMPLETED' }
    })
    console.log(`\n✅ Quiz ${quizId} marked as COMPLETED`)
  }

  console.log(`\n📊 Prize Distribution Summary:`)
  console.log(`  ✅ Distributed: ${results.distributed}`)
  console.log(`  ❌ Failed: ${results.failed}`)
  console.log(`  💰 Total Amount: ${results.totalAmount} sats`)
  
  // Convert BigInt to string for JSON serialization
  return {
    ...results,
    totalAmount: results.totalAmount.toString()
  }
}

/**
 * Collect entry fees from all attempts and send to teacher
 * Platform fee is deducted automatically
 * 
 * @param quizId - Quiz ID to collect fees for
 * @returns Collection results
 */
export async function collectEntryFees(quizId: string) {
  console.log(`\n💵 Collecting entry fees for quiz ${quizId}`)
  
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      teacher: true,
      attempts: {
        where: {
          status: { in: ['COMMITTED', 'REVEALED', 'VERIFIED'] }
        },
        include: {
          student: true
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

  // Note: In our custodial model, entry fees are paid from student wallets when they submit
  // This function is for record-keeping and potential future direct transfers
  
  // Convert BigInt to strings for JSON serialization
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
 * @param quizId - Quiz ID to refresh balances for
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
      const computer = await getUserWallet(userId)
      await computer.sync()
      const { balance } = await computer.getBalance()
      
      // Update database with fresh balance
      await prisma.user.update({
        where: { id: userId },
        data: {
          walletBalance: balance,
          lastBalanceCheck: new Date()
        }
      })
      
      console.log(`  ✅ User ${userId}: ${balance.toString()} sats`)
    } catch (error) {
      console.error(`  ❌ Failed to update user ${userId}:`, error)
    }
  }

  console.log(`✅ Balance refresh complete`)
}

/**
 * Complete quiz payment cycle
 * 1. Distribute prizes to winners
 * 2. Refresh all balances
 * 3. Return summary
 * 
 * @param quizId - Quiz ID to process payments for
 */
export async function processQuizPayments(quizId: string) {
  console.log(`\n💳 Processing quiz payments for ${quizId}`)
  console.log(`${'='.repeat(50)}`)
  
  try {
    // Step 1: Distribute prizes
    const prizeResults = await distributePrizes(quizId)
    
    // Step 2: Collect entry fee info (for records)
    const feeResults = await collectEntryFees(quizId)
    
    // Step 3: Refresh balances
    await refreshQuizBalances(quizId)
    
    console.log(`\n✅ Payment processing complete!`)
    console.log(`${'='.repeat(50)}`)
    
    return {
      success: true,
      prizes: prizeResults,
      fees: feeResults
    }
  } catch (error) {
    console.error(`\n❌ Payment processing failed:`, error)
    throw error
  }
}
