/**
 * Payment Distribution Service (Decentralized Bitcoin Computer Model)
 *
 * This implements proper decentralized Bitcoin Computer payment distribution:
 * - Teachers create Quiz contracts with prize pool LOCKED in contract satoshis
 * - Students submit QuizAttempt contracts with entry fees LOCKED in contract satoshis
 * - Quiz.distributePrizes() creates Payment contracts FROM Quiz's locked satoshis (not teacher wallet)
 * - QuizAttempt.collectFee() creates Payment contracts FROM attempt's locked satoshis
 * - Students/teachers claim Payment contracts to receive funds
 *
 * CRITICAL: Uses computer.encode() + broadcast() pattern for contract method calls.
 * Direct method calls (contract.method()) don't work with Bitcoin Computer v0.26.0-beta.0
 * because nested contract creation requires proper _computer context.
 *
 * Fund Flow:
 * 1. Teacher deposits → Quiz contract (185k sats locked)
 * 2. Students pay entry fees → QuizAttempt contracts (18.5k each locked)
 * 3. Teacher reveals → Quiz.distributePrizes() → Payment contracts (FROM Quiz's 185k)
 * 4. System calls collectFee() → Payment contracts (FROM QuizAttempt satoshis)
 * 5. Recipients claim() → Funds released to their wallets
 *
 * Result: Teacher net = entry fees collected - prizes paid (all from contract funds)
 */

import { prisma } from './prisma'
import { getUserWallet, getUserBalance } from './wallet-service'

/**
 * Utility function to wait for a transaction to clear the mempool
 * Retries with exponential backoff on mempool conflicts
 */
async function withMempoolRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  maxRetries: number = 5,
  initialDelayMs: number = 3000
): Promise<T> {
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      const isMempoolConflict = lastError.message.includes('txn-mempool-conflict')
      const isTooLongChain = lastError.message.includes('too-long-mempool-chain')

      // Special handling for too-long-mempool-chain - needs much longer waits
      if (isTooLongChain) {
        if (attempt === maxRetries) {
          console.error(`\n⚠️  MEMPOOL ANCESTOR LIMIT REACHED`)
          console.error(`Bitcoin allows maximum 25 unconfirmed transactions in a chain.`)
          console.error(`You have too many pending transactions. Wait 10-20 minutes.`)
          throw new Error(`Mempool ancestor limit exceeded. Please wait for pending transactions to confirm before attempting more operations.`)
        }
        
        // Much longer delays for ancestor chain issues (15s, 30s, 60s, 120s, 240s)
        const delayMs = 15000 * Math.pow(2, attempt - 1)
        console.log(`  ⏳ ${operationName}: TOO MANY UNCONFIRMED ANCESTORS, waiting ${delayMs/1000}s for confirmations... (${attempt}/${maxRetries})`)
        await new Promise(resolve => setTimeout(resolve, delayMs))
        continue
      }

      if (isMempoolConflict) {
        if (attempt === maxRetries) {
          throw lastError
        }
        
        // Standard exponential backoff for regular mempool conflicts
        const delayMs = initialDelayMs * Math.pow(2, attempt - 1)
        console.log(`  ⏳ ${operationName}: mempool conflict, waiting ${delayMs/1000}s before retry ${attempt + 1}/${maxRetries}...`)
        await new Promise(resolve => setTimeout(resolve, delayMs))
        continue
      }

      // Not a mempool issue - throw immediately
      throw lastError
    }
  }

  throw lastError
}

/**
 * Poll for quiz contract to reach 'revealed' status
 * Blockchain confirmation takes time - poll until status updates
 */
async function pollForRevealedStatus(
  computer: any,
  quizRev: string,
  maxAttempts: number = 10,
  delayMs: number = 3000
): Promise<any> {
  console.log(`  ⏳ Polling for quiz status to be 'revealed'...`)
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const contract = await computer.sync(quizRev)
    
    console.log(`  Attempt ${attempt}/${maxAttempts}: Status = ${contract.status}`)
    
    if (contract.status === 'revealed') {
      console.log(`  ✅ Quiz is now revealed!`)
      return contract
    }
    
    if (attempt < maxAttempts) {
      console.log(`  ⏳ Waiting ${delayMs/1000}s before retry...`)
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }
  
  throw new Error(`Quiz status did not update to 'revealed' after ${maxAttempts} attempts (${maxAttempts * delayMs / 1000}s). Blockchain confirmation may be delayed.`)
}

/**
 * NOTE: Payment contracts are now created inside Quiz.distributePrizes() method.
 * The Quiz contract creates Payment contracts using its own locked satoshis,
 * ensuring funds flow correctly from Quiz → Payment → Student wallets.
 *
 * The PaymentContractSource definition is no longer needed here.
 */

/**
 * Distribute prizes to winners by creating Payment contracts
 * Each Payment contract holds the prize amount for a winner to claim
 * 
 * @param quizId - Quiz database ID
 * @param revealedQuizRev - UPDATED quiz contract revision after revealAnswers (with status 'revealed')
 */
export async function distributePrizesToWinners(quizId: string, revealedQuizRev?: string) {
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
    console.log('  ℹ️  No unpaid winners')
    return {
      distributed: 0,
      totalAmount: '0',
      payments: []
    }
  }

  console.log(`  Found ${quiz.winners.length} winners to pay`)
  console.log(`  Prize pool: ${quiz.prizePool} sats`)
  
  // Use the REVEALED quiz revision (passed from reveal route) or fall back to DB
  const quizRevToUse = revealedQuizRev || quiz.contractRev
  console.log(`  Quiz contract rev: ${quizRevToUse}`)
  if (revealedQuizRev) {
    console.log(`  ✅ Using REVEALED revision (status: 'revealed')`)
  } else {
    console.log(`  ⚠️  Using DB revision (may be outdated)`)
  }

  // Get teacher's Computer instance to call Quiz contract
  const teacherComputer = await getUserWallet(quiz.teacherId)

  console.log(`\n  📝 Syncing Quiz contract and waiting for 'revealed' status...`)
  console.log(`  This may take 10-30 seconds for blockchain confirmation`)
  
  // Poll for revealed status - blockchain confirmation takes time
  let quizContract
  try {
    quizContract = await pollForRevealedStatus(teacherComputer, quizRevToUse, 10, 3000)
  } catch (pollError) {
    console.error(`  ❌ Failed to get revealed status:`, pollError)
    throw new Error(`Quiz contract not in revealed status after waiting. ${pollError instanceof Error ? pollError.message : 'Unknown error'}`)
  }

  console.log(`  ✅ Quiz synced - Status: ${quizContract.status}, Satoshis: ${quizContract._satoshis}`)

  // Prepare winner data for distributePrizes
  const winnersData = quiz.winners.map(w => ({
    student: w.attempt.student.publicKey,
    attemptId: w.attemptId
  }))

  console.log(`\n  💰 Calling Quiz.distributePrizes() via encode/broadcast pattern...`)
  console.log(`  This will:`)
  console.log(`    1. Create Payment contracts for ${winnersData.length} winners`)
  console.log(`    2. Use ${quizContract._satoshis - BigInt(546)} sats FROM Quiz contract`)
  console.log(`    3. Reduce Quiz satoshis to dust (546 sats)`)
  console.log(`    4. Teacher's wallet NOT touched (funds come from Quiz contract)`)

  let paymentRevs: string[]
  let distributeTxId: string
  
  try {
    // Use encode/broadcast pattern - the ONLY way that works with Bitcoin Computer
    // This calls distributePrizes on the Quiz contract, which creates Payment contracts
    // using the Quiz contract's locked satoshis
    const { tx, effect } = await withMempoolRetry(
      async () => {
        return await teacherComputer.encode({
          exp: `${quizRevToUse}.distributePrizes(${JSON.stringify(winnersData)})`,
          env: { [quizRevToUse]: quizContract }
        })
      },
      'Encode distributePrizes transaction',
      3,
      3000
    )

    console.log(`  ✅ Transaction encoded successfully`)

    // Broadcast the transaction
    distributeTxId = await withMempoolRetry(
      async () => {
        return await teacherComputer.broadcast(tx)
      },
      'Broadcast distributePrizes transaction',
      3,
      3000
    )

    console.log(`  ✅ Transaction broadcasted: ${distributeTxId}`)
    console.log(`  ⏳ Waiting 5 seconds for blockchain confirmation...`)
    await new Promise(resolve => setTimeout(resolve, 5000))

    // Extract payment revisions from effect
    paymentRevs = effect.res as string[]
    
    if (!Array.isArray(paymentRevs) || paymentRevs.length !== winnersData.length) {
      throw new Error(`Expected ${winnersData.length} payment revisions, got ${paymentRevs?.length || 0}`)
    }

    console.log(`  ✅ distributePrizes SUCCESS!`)
    console.log(`  Created ${paymentRevs.length} Payment contracts from Quiz's locked funds`)

    // Re-sync to verify satoshis were reduced
    const updatedQuiz = await teacherComputer.sync(quizRevToUse)
    console.log(`  Quiz satoshis: ${quizContract._satoshis} → ${updatedQuiz._satoshis}`)
    console.log(`  Quiz status: ${quizContract.status} → ${updatedQuiz.status}`)
    
    if (updatedQuiz._satoshis > BigInt(546)) {
      console.log(`  ⚠️  WARNING: Quiz still has ${updatedQuiz._satoshis} sats (expected 546)`)
    }
  } catch (error) {
    console.error(`  ❌ distributePrizes FAILED:`, error)
    throw new Error(`Failed to distribute prizes from Quiz contract: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  // Update database with Payment contract revisions
  const paymentResults = []
  let totalDistributed = BigInt(0)

  for (let i = 0; i < quiz.winners.length; i++) {
    const winner = quiz.winners[i]
    const paymentRev = paymentRevs[i]

    try {
      console.log(`\n  💾 Updating DB for winner ${i + 1}:`)
      console.log(`    Student: ${winner.attempt.student.name}`)
      console.log(`    Payment Rev: ${paymentRev}`)

      // Mark winner as paid
      await prisma.winner.update({
        where: { id: winner.id },
        data: {
          paid: true,
          paidTxHash: paymentRev
        }
      })

      // Update student earnings
      await prisma.user.update({
        where: { id: winner.attempt.studentId },
        data: {
          totalEarnings: { increment: winner.prizeAmount }
        }
      })

      // Update attempt with prize
      await prisma.quizAttempt.update({
        where: { id: winner.attemptId },
        data: {
          prizeAmount: winner.prizeAmount
        }
      })

      totalDistributed += winner.prizeAmount

      paymentResults.push({
        winnerId: winner.id,
        studentId: winner.attempt.studentId,
        studentAddress: winner.attempt.student.address,
        studentPublicKey: winner.attempt.student.publicKey,
        amount: winner.prizeAmount.toString(),
        paymentRev: paymentRev,
        txId: paymentRev.split(':')[0],
        status: 'success' as const,
        canClaim: true
      })

      console.log(`    ✅ DB updated`)

    } catch (error) {
      console.error(`  ❌ DB update failed for winner ${winner.id}:`, error)

      paymentResults.push({
        winnerId: winner.id,
        studentId: winner.attempt.studentId,
        studentAddress: winner.attempt.student.address || 'N/A',
        studentPublicKey: winner.attempt.student.publicKey || 'N/A',
        amount: winner.prizeAmount.toString(),
        paymentRev: paymentRev || 'DB_FAILED',
        txId: 'DB_FAILED',
        status: 'failed' as const,
        canClaim: false,
        error: error instanceof Error ? error.message : 'DB update failed'
      })
    }
  }

  console.log(`\n📊 Prize Distribution Summary:`)
  console.log(`  ✅ Winners paid: ${paymentResults.filter(p => p.status === 'success').length}`)
  console.log(`  ❌ Failed: ${paymentResults.filter(p => p.status === 'failed').length}`)
  console.log(`  💰 Total distributed from Quiz contract's locked funds: ${totalDistributed} sats`)
  console.log(`  📝 Payment contracts created and claimable by students`)

  return {
    distributed: paymentResults.filter(p => p.status === 'success').length,
    totalAmount: totalDistributed.toString(),
    payments: paymentResults
  }
}

/**
 * Calculate entry fee distribution
 * Entry fees were paid by students when they attempted the quiz
 * This is for accounting/display purposes - the funds are already in the contracts
 */
export async function payEntryFeesToTeacher(quizId: string) {
  console.log(`\n💵 Calculating entry fees for quiz ${quizId}`)

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
    console.log('  ℹ️  No attempts to calculate')
    return {
      collected: 0,
      totalTeacherAmount: '0',
      totalPlatformFee: '0',
      payments: []
    }
  }

  console.log(`  Found ${attemptCount} attempts`)

  // Calculate entry fee distribution (for accounting)
  const totalEntryFees = quiz.entryFee * BigInt(attemptCount)
  const platformFeeAmount = BigInt(Math.floor(Number(totalEntryFees) * quiz.platformFee))
  const teacherAmount = totalEntryFees - platformFeeAmount

  console.log(`\n📊 Entry Fee Calculation:`)
  console.log(`  Attempts: ${attemptCount}`)
  console.log(`  Entry Fee per attempt: ${quiz.entryFee} sats`)
  console.log(`  Total Entry Fees: ${totalEntryFees} sats`)
  console.log(`  Platform Fee (${quiz.platformFee * 100}%): ${platformFeeAmount} sats`)
  console.log(`  Teacher Amount: ${teacherAmount} sats`)

  // Entry fees are locked in QuizAttempt contracts
  // In a full implementation, we would create Payment contracts for the teacher
  // For now, we track the amounts for display purposes
  const payments = quiz.attempts.map(attempt => ({
    attemptId: attempt.id,
    studentId: attempt.studentId,
    teacherAmount: (quiz.entryFee - BigInt(Math.floor(Number(quiz.entryFee) * quiz.platformFee))).toString(),
    platformFee: BigInt(Math.floor(Number(quiz.entryFee) * quiz.platformFee)).toString(),
    status: 'accounted' as const // Marked as accounted (funds in contracts)
  }))

  return {
    collected: attemptCount,
    totalTeacherAmount: teacherAmount.toString(),
    totalPlatformFee: platformFeeAmount.toString(),
    payments
  }
}

/**
 * Complete payment flow
 * 1. Create Payment contracts for winners (actual blockchain contracts)
 * 2. Calculate entry fee distribution (for accounting)
 * 
 * @param quizId - Quiz database ID
 * @param revealedQuizRev - UPDATED quiz contract revision after revealAnswers (status 'revealed')
 */
export async function processCompletePayments(quizId: string, revealedQuizRev?: string) {
  console.log(`\n💳 Processing complete payments for ${quizId}`)
  console.log(`${'='.repeat(60)}`)

  try {
    // 1. Create Payment contracts for winners
    console.log(`\n📤 Step 1: Creating Payment contracts for winners...`)
    const prizeResults = await distributePrizesToWinners(quizId, revealedQuizRev)

    // 2. Calculate entry fee distribution (for display)
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

    // 5. Refresh balances from blockchain
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
      attempts: { select: { studentId: true } }
    }
  })

  if (!quiz) return

  const userIds = new Set([quiz.teacherId, ...quiz.attempts.map(a => a.studentId)])

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
 * Claim a Payment contract
 *
 * Winners can claim their Payment contracts to release funds to their wallets.
 * This reduces the Payment contract to dust (546 sats) and releases the funds.
 *
 * @param userId - User claiming the payment
 * @param paymentRev - Payment contract revision
 */
export async function claimPayment(userId: string, paymentRev: string) {
  console.log(`\n💰 Claiming payment: ${paymentRev}`)
  console.log(`  User: ${userId}`)

  try {
    // Get user's wallet
    const computer = await getUserWallet(userId)

    // Sync the Payment contract
    console.log(`  📝 Syncing Payment contract...`)
    const paymentContract = await computer.sync(paymentRev)

    if (!paymentContract) {
      throw new Error('Payment contract not found')
    }

    console.log(`  Status: ${paymentContract.status}`)
    console.log(`  Amount: ${paymentContract.amount} sats`)
    console.log(`  Satoshis locked: ${paymentContract._satoshis}`)

    if (paymentContract.status === 'claimed') {
      console.log(`  ℹ️ Payment already claimed`)
      return {
        success: true,
        message: 'Payment already claimed',
        paymentRev,
        amount: paymentContract.amount.toString()
      }
    }

    // Claim the payment using encode/broadcast pattern
    console.log(`  🎯 Calling Payment.claim() via encode/broadcast...`)

    await withMempoolRetry(
      async () => {
        const { tx } = await computer.encode({
          exp: `${paymentRev}.claim()`,
          env: { [paymentRev]: paymentContract }
        })
        await computer.broadcast(tx)
      },
      'Claim payment',
      3,
      2000
    )

    // Wait for blockchain confirmation
    await new Promise(resolve => setTimeout(resolve, 3000))

    // Refresh user balance from blockchain
    const newBalance = await getUserBalance(userId)

    console.log(`  ✅ Payment claimed successfully!`)
    console.log(`  New balance: ${newBalance} sats`)

    return {
      success: true,
      message: 'Payment claimed successfully. Funds released to your wallet.',
      paymentRev,
      amount: paymentContract.amount.toString(),
      newBalance: newBalance.toString()
    }

  } catch (error) {
    console.error(`  ❌ Failed to claim payment:`, error)
    throw error
  }
}
