/**
 * Payment Distribution Service (Contract-Based)
 *
 * This implements proper Bitcoin Computer payment distribution:
 * - Prize pool is locked in the Quiz contract (teacher paid upfront)
 * - Entry fees are locked in QuizAttempt contracts (students paid on submission)
 * - We create Payment contracts for each winner using computer.encode/broadcast
 * - Recipients claim Payment contracts to release funds to their wallets
 *
 * IMPORTANT: We cannot use computer.send() because Bitcoin Computer locks ALL
 * satoshis in smart contracts. The send() method requires spendable UTXOs which
 * don't exist. Instead, we create Payment contracts that hold the prize money.
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

      if (!isMempoolConflict || attempt === maxRetries) {
        throw lastError
      }

      // Exponential backoff: 3s, 6s, 12s, 24s, 48s
      const delayMs = initialDelayMs * Math.pow(2, attempt - 1)
      console.log(`  ⏳ ${operationName}: mempool conflict, waiting ${delayMs/1000}s before retry ${attempt + 1}/${maxRetries}...`)
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }

  throw lastError
}

/**
 * Payment contract source code for deployment
 *
 * NOTE: Bitcoin Computer's deploy() method expects a STRING containing JavaScript source code,
 * not an imported class. The contract is inscribed in a Bitcoin transaction and the
 * transaction id becomes the module specifier.
 *
 * This is defined inline (like Quiz and QuizAttempt contracts in their API routes)
 * rather than imported from /contracts/Payment.js
 */
// Payment contract source code - pure JavaScript, no imports
// Contract class is available globally in Bitcoin Computer runtime
const PaymentContractSource = `
  export class Payment extends Contract {
    constructor(recipient, amount, purpose, reference) {
      if (!recipient) throw new Error('Recipient required')
      if (amount < 546n) throw new Error('Amount must be at least 546 satoshis (dust limit)')
      if (!purpose) throw new Error('Purpose required')

      super({
        _owners: [recipient],
        _satoshis: amount,
        recipient,
        amount,
        purpose,
        reference,
        status: 'unclaimed',
        createdAt: Date.now(),
        claimedAt: null
      })
    }

    claim() {
      if (this.status === 'claimed') {
        throw new Error('Payment already claimed')
      }
      this._satoshis = 546n
      this.status = 'claimed'
      this.claimedAt = Date.now()
      return this
    }

    getInfo() {
      return {
        paymentId: this._id,
        recipient: this.recipient,
        amount: this.amount,
        purpose: this.purpose,
        reference: this.reference,
        status: this.status,
        createdAt: this.createdAt,
        claimedAt: this.claimedAt,
        canClaim: this.status === 'unclaimed'
      }
    }
  }
`

/**
 * Distribute prizes to winners by creating Payment contracts
 * Each Payment contract holds the prize amount for a winner to claim
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
    console.log('  ℹ️  No unpaid winners')
    return {
      distributed: 0,
      totalAmount: '0',
      payments: []
    }
  }

  console.log(`  Found ${quiz.winners.length} winners to pay`)
  console.log(`  Prize pool: ${quiz.prizePool} sats`)
  console.log(`  Quiz contract rev: ${quiz.contractRev}`)

  // Get teacher's wallet to create Payment contracts
  const teacherComputer = await getUserWallet(quiz.teacherId)

  // Deploy Payment contract module (only once)
  // NOTE: deploy() expects a STRING of JavaScript source code, not an imported class
  // Uses retry logic to handle mempool conflicts from previous transactions
  console.log(`\n  📦 Deploying Payment contract module...`)
  const paymentModuleSpecifier = await withMempoolRetry(
    () => teacherComputer.deploy(PaymentContractSource),
    'Deploy Payment module',
    5,  // max 5 retries
    5000 // start with 5 second delay (previous reveal tx needs time to confirm)
  )
  console.log(`  ✅ Payment module deployed: ${paymentModuleSpecifier}`)

  let totalDistributed = BigInt(0)
  const paymentResults = []

  // First, sync the quiz contract and update it to mark as distributing
  console.log(`\n  📝 Syncing Quiz contract...`)
  const quizContract = await teacherComputer.sync(quiz.contractRev)

  if (!quizContract) {
    throw new Error('Failed to sync Quiz contract from blockchain')
  }

  console.log(`  Contract status: ${quizContract.status}`)
  console.log(`  Contract satoshis: ${quizContract._satoshis}`)

  // Process each winner - create a Payment contract for them
  for (let i = 0; i < quiz.winners.length; i++) {
    const winner = quiz.winners[i]

    try {
      console.log(`\n  🏆 Creating payment for winner ${i + 1}:`)
      console.log(`    Student: ${winner.attempt.student.name}`)
      console.log(`    Public Key: ${winner.attempt.student.publicKey}`)
      console.log(`    Score: ${winner.score}%`)
      console.log(`    Prize: ${winner.prizeAmount} sats`)

      const studentPublicKey = winner.attempt.student.publicKey
      if (!studentPublicKey) {
        throw new Error('Student has no public key')
      }

      console.log(`    Creating Payment contract...`)

      // Wrap encode+broadcast with retry logic for mempool conflicts
      const { txId, paymentContract } = await withMempoolRetry(
        async () => {
          const { tx, effect } = await teacherComputer.encode({
            mod: paymentModuleSpecifier,
            exp: `new Payment("${studentPublicKey}", BigInt(${winner.prizeAmount}), "Quiz Prize - ${quiz.title || quiz.id}", "${quizId}")`
          })

          const broadcastTxId = await teacherComputer.broadcast(tx)
          const contract = effect.res as { _id: string; _rev: string }

          return { txId: broadcastTxId, paymentContract: contract }
        },
        `Create Payment for ${winner.attempt.student.name}`,
        3,  // 3 retries for each payment
        2000 // 2 second initial delay
      )

      console.log(`    Transaction ID: ${txId}`)
      console.log(`    Payment contract ID: ${paymentContract._id}`)
      console.log(`    Payment contract rev: ${paymentContract._rev}`)

      // Mark winner as paid with Payment contract revision
      await prisma.winner.update({
        where: { id: winner.id },
        data: {
          paid: true,
          paidTxHash: paymentContract._rev // Store Payment contract revision for claiming
        }
      })

      // Update student's total earnings
      await prisma.user.update({
        where: { id: winner.attempt.studentId },
        data: {
          totalEarnings: { increment: winner.prizeAmount }
        }
      })

      // Update attempt with prize amount
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
        studentPublicKey: studentPublicKey,
        amount: winner.prizeAmount.toString(),
        paymentRev: paymentContract._rev,
        txId: txId,
        status: 'success' as const,
        canClaim: true
      })

      console.log(`    ✅ Payment contract created successfully!`)

      // Small delay between transactions to avoid nonce issues
      await new Promise(resolve => setTimeout(resolve, 1000))

    } catch (error) {
      console.error(`  ❌ Failed to create payment for winner ${winner.id}:`, error)

      paymentResults.push({
        winnerId: winner.id,
        studentId: winner.attempt.studentId,
        studentAddress: winner.attempt.student.address || 'N/A',
        studentPublicKey: winner.attempt.student.publicKey || 'N/A',
        amount: winner.prizeAmount.toString(),
        paymentRev: 'FAILED',
        txId: 'FAILED',
        status: 'failed' as const,
        canClaim: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  // Mark quiz contract as completed via the complete() method
  if (paymentResults.some(p => p.status === 'success')) {
    try {
      console.log(`\n  📝 Marking quiz contract as completed...`)

      // Re-sync to get latest state
      const latestQuizContract = await teacherComputer.sync(quiz.contractRev)

      if (latestQuizContract.status === 'revealed') {
        // Call complete() method to mark as completed
        latestQuizContract.complete(quiz.winners.map(w => ({
          student: w.attempt.student.publicKey,
          amount: w.prizeAmount.toString()
        })))

        // Wait for blockchain confirmation
        await new Promise(resolve => setTimeout(resolve, 2000))

        // Get updated contract revision
        const updatedContract = await teacherComputer.sync(quiz.contractRev)

        await prisma.quiz.update({
          where: { id: quizId },
          data: {
            contractRev: updatedContract._rev
          }
        })

        console.log(`  ✅ Quiz contract marked as completed`)
      }
    } catch (error) {
      console.error(`  ⚠️ Failed to update quiz contract status:`, error)
      // Non-fatal - payments were still created
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
 */
export async function processCompletePayments(quizId: string) {
  console.log(`\n💳 Processing complete payments for ${quizId}`)
  console.log(`${'='.repeat(60)}`)

  try {
    // 1. Create Payment contracts for winners
    console.log(`\n📤 Step 1: Creating Payment contracts for winners...`)
    const prizeResults = await distributePrizesToWinners(quizId)

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

    // Claim the payment (reduces satoshis to dust, releases funds to owner's wallet)
    console.log(`  🎯 Calling Payment.claim()...`)
    paymentContract.claim()

    // Wait for blockchain confirmation
    await new Promise(resolve => setTimeout(resolve, 2000))

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
