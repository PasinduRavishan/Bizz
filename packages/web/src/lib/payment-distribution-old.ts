/**
 * Complete Payment Distribution Service
 * 
 * This implements ACTUAL satoshi transfers using custodial wallets.
 * Works around contract limitations by using off-chain transfers.
 */

import { prisma } from './prisma'
import { getUserWallet, getUserBalance } from './wallet-service'

/**
 * Send satoshis from one user to another using Computer.send()
 */
async function sendSatoshis(
  fromUserId: string,
  toAddress: string,
  amountSats: bigint,
  description: string
): Promise<string> {
  console.log(`\n💸 Sending ${amountSats} sats`)
  console.log(`  From user: ${fromUserId}`)
  console.log(`  To address: ${toAddress}`)
  console.log(`  Description: ${description}`)

  // Get sender's wallet
  const computer = await getUserWallet(fromUserId)
  
  // Check balance and UTXOs
  const { balance, utxos } = await computer.getBalance()
  const amountBTC = Number(amountSats) / 1e8
  
  console.log(`  Current balance: ${balance} sats`)
  console.log(`  Available UTXOs: ${utxos?.length || 0}`)
  
  if (balance < amountSats) {
    throw new Error(`Insufficient balance. Have ${balance} sats, need ${amountSats} sats`)
  }

  if (!utxos || utxos.length === 0) {
    throw new Error(`No UTXOs available. Balance is locked in contracts. Wallet needs to be funded with spendable UTXOs.`)
  }

  // Send payment
  console.log(`  Converting ${amountSats} sats to ${amountBTC} BTC`)
  const txHash = await computer.send(toAddress, amountBTC)
  
  console.log(`  ✅ Sent! TX: ${txHash}`)
  
  return txHash
}

/**
 * Distribute prizes to winners FROM TEACHER'S WALLET
 * Teacher pays winners directly (they already paid prize pool to contract)
 */
export async function distributePrizesToWinners(quizId: string) {
  console.log(`\n🏆 Distributing prizes for quiz ${quizId}`)

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
    console.log('  No unpaid winners')
    return {
      distributed: 0,
      totalAmount: '0',
      transactions: []
    }
  }

  console.log(`  Found ${quiz.winners.length} winners`)
  console.log(`  Paying from teacher's wallet...`)

  const results = {
    distributed: 0,
    failed: 0,
    totalAmount: BigInt(0),
    transactions: [] as Array<{
      winnerId: string
      studentAddress: string
      amount: string
      txHash: string
      status: 'success' | 'failed'
    }>
  }

  for (const winner of quiz.winners) {
    try {
      const studentAddress = winner.attempt.student.address
      const prizeAmount = winner.prizeAmount

      if (!studentAddress) {
        throw new Error(`Student ${winner.attempt.student.name} has no wallet address`)
      }

      console.log(`\n  Winner: ${winner.attempt.student.name} (${studentAddress})`)
      console.log(`  Prize: ${prizeAmount} sats`)

      // Send from teacher to student
      const txHash = await sendSatoshis(
        quiz.teacherId,
        studentAddress,
        prizeAmount,
        `Quiz Prize - ${quiz.title || quiz.id}`
      )

      // Mark as paid
      await prisma.winner.update({
        where: { id: winner.id },
        data: {
          paid: true,
          paidTxHash: txHash
        }
      })

      // Update student earnings
      await prisma.user.update({
        where: { id: winner.attempt.userId },
        data: {
          totalEarnings: { increment: prizeAmount }
        }
      })

      results.distributed++
      results.totalAmount += prizeAmount
      results.transactions.push({
        winnerId: winner.id,
        studentAddress,
        amount: prizeAmount.toString(),
        txHash,
        status: 'success'
      })

      console.log(`  ✅ Prize sent!`)

    } catch (error) {
      console.error(`  ❌ Failed:`, error)
      results.failed++
      results.transactions.push({
        winnerId: winner.id,
        studentAddress: winner.attempt.student.address || 'NO_ADDRESS',
        amount: winner.prizeAmount.toString(),
        txHash: 'FAILED',
        status: 'failed'
      })
    }
  }

  console.log(`\n📊 Prize Distribution Summary:`)
  console.log(`  ✅ Distributed: ${results.distributed}`)
  console.log(`  ❌ Failed: ${results.failed}`)
  console.log(`  💰 Total: ${results.totalAmount} sats`)

  return {
    ...results,
    totalAmount: results.totalAmount.toString()
  }
}

/**
 * Pay entry fees to teacher FROM EACH STUDENT'S WALLET
 * Students send their entry fee (minus platform fee) to teacher
 */
export async function payEntryFeesToTeacher(quizId: string) {
  console.log(`\n💵 Collecting entry fees for quiz ${quizId}`)

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

  if (quiz.attempts.length === 0) {
    console.log('  No attempts to collect from')
    return {
      collected: 0,
      totalTeacherAmount: '0',
      totalPlatformFee: '0',
      transactions: []
    }
  }

  console.log(`  Found ${quiz.attempts.length} attempts`)

  const results = {
    collected: 0,
    failed: 0,
    totalTeacherAmount: BigInt(0),
    totalPlatformFee: BigInt(0),
    transactions: [] as Array<{
      attemptId: string
      userId: string
      teacherAmount: string
      platformFee: string
      txHash: string
      status: 'success' | 'failed'
    }>
  }

  for (const attempt of quiz.attempts) {
    try {
      const entryFee = quiz.entryFee
      const platformFeeAmount = BigInt(Math.floor(Number(entryFee) * quiz.platformFee))
      const teacherAmount = entryFee - platformFeeAmount

      if (!quiz.teacher.address) {
        throw new Error(`Teacher has no wallet address`)
      }

      console.log(`\n  Attempt: ${attempt.id}`)
      console.log(`  Student: ${attempt.student.name}`)
      console.log(`  Entry fee: ${entryFee} sats`)
      console.log(`  Teacher gets: ${teacherAmount} sats`)
      console.log(`  Platform fee: ${platformFeeAmount} sats`)

      // Send from student to teacher
      const txHash = await sendSatoshis(
        attempt.userId,
        quiz.teacher.address,
        teacherAmount,
        `Entry Fee - ${quiz.title || quiz.id}`
      )

      results.collected++
      results.totalTeacherAmount += teacherAmount
      results.totalPlatformFee += platformFeeAmount
      results.transactions.push({
        attemptId: attempt.id,
        userId: attempt.userId,
        teacherAmount: teacherAmount.toString(),
        platformFee: platformFeeAmount.toString(),
        txHash,
        status: 'success'
      })

      console.log(`  ✅ Entry fee sent to teacher!`)

    } catch (error) {
      console.error(`  ❌ Failed:`, error)
      results.failed++
      results.transactions.push({
        attemptId: attempt.id,
        userId: attempt.userId,
        teacherAmount: '0',
        platformFee: '0',
        txHash: 'FAILED',
        status: 'failed'
      })
    }
  }

  console.log(`\n📊 Entry Fee Collection Summary:`)
  console.log(`  ✅ Collected: ${results.collected}`)
  console.log(`  ❌ Failed: ${results.failed}`)
  console.log(`  💰 Teacher received: ${results.totalTeacherAmount} sats`)
  console.log(`  🏦 Platform fee: ${results.totalPlatformFee} sats`)

  // Store platform fee for later collection
  await prisma.quiz.update({
    where: { id: quizId },
    data: {
      // Store this in a JSON field or create a PlatformFee model
      updatedAt: new Date()
    }
  })

  return {
    ...results,
    totalTeacherAmount: results.totalTeacherAmount.toString(),
    totalPlatformFee: results.totalPlatformFee.toString()
  }
}

/**
 * Complete payment flow: prizes to winners + entry fees to teacher
 */
export async function processCompletePayments(quizId: string) {
  console.log(`\n💳 Processing complete payments for ${quizId}`)
  console.log(`${'='.repeat(60)}`)

  try {
    // 1. Distribute prizes from teacher to winners
    console.log(`\n📤 Step 1: Distributing prizes...`)
    const prizeResults = await distributePrizesToWinners(quizId)

    // 2. Collect entry fees from students to teacher
    console.log(`\n📥 Step 2: Collecting entry fees...`)
    const feeResults = await payEntryFeesToTeacher(quizId)

    // 3. Calculate net result for teacher
    const prizesDistributed = BigInt(prizeResults.totalAmount)
    const feesCollected = BigInt(feeResults.totalTeacherAmount)
    const netTeacherChange = feesCollected - prizesDistributed

    console.log(`\n💰 Net Teacher Change:`)
    console.log(`  Entry fees collected: +${feesCollected} sats`)
    console.log(`  Prizes distributed: -${prizesDistributed} sats`)
    console.log(`  Net change: ${netTeacherChange > 0 ? '+' : ''}${netTeacherChange} sats`)

    // 4. Mark quiz as completed
    await prisma.quiz.update({
      where: { id: quizId },
      data: { status: 'COMPLETED' }
    })

    // 5. Refresh all balances
    await refreshBalances(quizId)

    console.log(`\n✅ Payment processing complete!`)
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
      attempts: { select: { userId: true } }
    }
  })

  if (!quiz) return

  const userIds = new Set([quiz.teacherId, ...quiz.attempts.map(a => a.userId)])

  for (const userId of userIds) {
    try {
      await getUserBalance(userId)
    } catch (error) {
      console.error(`  Failed to refresh ${userId}:`, error)
    }
  }

  console.log(`  ✅ Balances refreshed`)
}
