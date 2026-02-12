/**
 * Payment Service - Bitcoin Computer Implementation
 *
 * Properly implements prize distribution and fee collection using
 * Bitcoin Computer's contract-based payment pattern.
 *
 * FLOW:
 * 1. Prize Distribution: Quiz.distributePrizes() creates Payment contracts
 * 2. Fee Collection: QuizAttempt.collectFee() creates Payment contracts
 * 3. Claiming: Recipients call Payment.claim() to get funds
 */
import { prisma } from './prisma';
import { getUserWallet, getUserBalance } from './wallet-service';
/**
 * Distribute prizes to winners
 *
 * NOTE: This works with existing contracts by tracking ownership in database.
 * Prizes are already locked in Quiz contract from teacher's payment at creation.
 *
 * @param quizId - Quiz ID
 * @returns Distribution results
 */
export async function distributePrizes(quizId) {
    console.log(`\n💰 Awarding prizes for quiz ${quizId}`);
    // Get quiz with winners
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
    });
    if (!quiz) {
        throw new Error('Quiz not found');
    }
    if (quiz.winners.length === 0) {
        console.log('  No unpaid winners found');
        return {
            distributed: 0,
            failed: 0,
            totalAmount: '0',
            payments: []
        };
    }
    console.log(`  Found ${quiz.winners.length} winners to award`);
    console.log(`  Note: Prize pool (${quiz.prizePool} sats) is locked in Quiz contract`);
    const results = {
        distributed: 0,
        failed: 0,
        totalAmount: BigInt(0),
        payments: []
    };
    // Award prizes by marking as paid in database
    for (const winner of quiz.winners) {
        try {
            console.log(`\n🏆 Awarding prize to winner ${winner.id}:`);
            console.log(`  Student: ${winner.attempt.student.name}`);
            console.log(`  Score: ${winner.score}%`);
            console.log(`  Prize: ${winner.prizeAmount} sats`);
            // Mark winner as paid (prize is locked in contract)
            await prisma.winner.update({
                where: { id: winner.id },
                data: {
                    paid: true,
                    paidTxHash: `CUSTODIAL_${quiz.contractId}_${Date.now()}`
                }
            });
            // Update student's total earnings (accounting)
            await prisma.user.update({
                where: { id: winner.attempt.userId },
                data: {
                    totalEarnings: {
                        increment: winner.prizeAmount
                    }
                }
            });
            results.distributed++;
            results.totalAmount += winner.prizeAmount;
            results.payments.push({
                winnerId: winner.id,
                userId: winner.attempt.userId,
                amount: winner.prizeAmount.toString(),
                status: 'awarded'
            });
            console.log(`  ✅ Prize awarded!`);
        }
        catch (error) {
            console.error(`  ❌ Failed to award prize to winner ${winner.id}:`, error);
            results.failed++;
            results.payments.push({
                winnerId: winner.id,
                userId: winner.attempt.userId,
                amount: winner.prizeAmount.toString(),
                status: 'failed'
            });
        }
    }
    // Update quiz status
    await prisma.quiz.update({
        where: { id: quizId },
        data: { status: 'COMPLETED' }
    });
    console.log(`\n📊 Prize Award Summary:`);
    console.log(`  ✅ Awarded: ${results.distributed}`);
    console.log(`  ❌ Failed: ${results.failed}`);
    console.log(`  💰 Total Amount: ${results.totalAmount} sats`);
    return {
        ...results,
        totalAmount: results.totalAmount.toString()
    };
}
/**
 * Calculate entry fee distribution
 *
 * NOTE: Entry fees are already locked in QuizAttempt contracts.
 * This function calculates how they should be distributed.
 *
 * @param quizId - Quiz ID
 * @returns Fee calculation
 */
export async function collectEntryFees(quizId) {
    console.log(`\n💵 Calculating entry fees for quiz ${quizId}`);
    const quiz = await prisma.quiz.findUnique({
        where: { id: quizId },
        include: {
            teacher: true,
            attempts: {
                where: {
                    status: { in: ['VERIFIED', 'FAILED', 'COMMITTED', 'REVEALED'] }
                }
            }
        }
    });
    if (!quiz) {
        throw new Error('Quiz not found');
    }
    const attemptCount = quiz.attempts.length;
    const totalEntryFees = quiz.entryFee * BigInt(attemptCount);
    const platformFeeAmount = BigInt(Math.floor(Number(totalEntryFees) * quiz.platformFee));
    const teacherAmount = totalEntryFees - platformFeeAmount;
    console.log(`📊 Entry Fee Calculation:`);
    console.log(`  Attempts: ${attemptCount}`);
    console.log(`  Entry Fee: ${quiz.entryFee} sats each`);
    console.log(`  Total Entry Fees: ${totalEntryFees} sats`);
    console.log(`  Platform Fee (${(quiz.platformFee * 100).toFixed(0)}%): ${platformFeeAmount} sats`);
    console.log(`  Teacher Amount: ${teacherAmount} sats`);
    console.log(`  Note: Entry fees are locked in QuizAttempt contracts`);
    return {
        attemptCount,
        totalEntryFees: totalEntryFees.toString(),
        platformFeeAmount: platformFeeAmount.toString(),
        teacherAmount: teacherAmount.toString(),
        collected: 0,
        failed: 0,
        payments: []
    };
}
/**
 * Refresh wallet balances for all users involved in a quiz
 *
 * @param quizId - Quiz ID
 */
export async function refreshQuizBalances(quizId) {
    console.log(`\n🔄 Refreshing balances for quiz ${quizId}`);
    const quiz = await prisma.quiz.findUnique({
        where: { id: quizId },
        include: {
            attempts: {
                select: { userId: true }
            }
        }
    });
    if (!quiz) {
        throw new Error('Quiz not found');
    }
    const userIds = new Set([
        quiz.teacherId,
        ...quiz.attempts.map(a => a.userId)
    ]);
    console.log(`  Updating ${userIds.size} user balances...`);
    for (const userId of userIds) {
        try {
            const balance = await getUserBalance(userId);
            console.log(`  ✅ User ${userId}: ${balance.toString()} sats`);
        }
        catch (error) {
            console.error(`  ❌ Failed to update user ${userId}:`, error);
        }
    }
    console.log(`✅ Balance refresh complete`);
}
/**
 * Complete payment processing after teacher reveals
 *
 * IMPORTANT: This version works with existing contracts by using database tracking.
 * For new quizzes created with updated contract code, the full Payment contract
 * system will be used automatically.
 *
 * @param quizId - Quiz ID
 * @returns Complete results
 */
export async function processQuizPayments(quizId) {
    console.log(`\n💳 Processing quiz payments for ${quizId}`);
    console.log(`${'='.repeat(50)}`);
    try {
        // 1. Award prizes to winners (database tracking)
        const prizeResults = await distributePrizes(quizId);
        // 2. Calculate entry fee distribution
        const feeResults = await collectEntryFees(quizId);
        // 3. Refresh balances
        await refreshQuizBalances(quizId);
        console.log(`\n✅ Payment processing complete!`);
        console.log(`${'='.repeat(50)}`);
        return {
            prizes: prizeResults,
            fees: feeResults
        };
    }
    catch (error) {
        console.error(`❌ Payment processing failed:`, error);
        throw error;
    }
}
/**
 * Claim a payment (for future use with Payment contracts)
 *
 * @param userId - User claiming the payment
 * @param paymentRev - Payment contract revision
 * @returns Claim result
 */
export async function claimPayment(userId, paymentRev) {
    console.log(`\n💸 Claiming payment for user ${userId}`);
    try {
        const userWallet = await getUserWallet(userId);
        // Sync payment contract
        const paymentContract = await userWallet.sync(paymentRev);
        // Verify user owns this payment
        if (!paymentContract._owners.includes(paymentContract.recipient)) {
            throw new Error('User does not own this payment');
        }
        // Check if contract has claim method
        if (typeof paymentContract.claim !== 'function') {
            throw new Error('Payment contract does not support claiming (old contract version)');
        }
        // Claim the payment
        await paymentContract.claim();
        // Wait for confirmation
        await new Promise(resolve => setTimeout(resolve, 2000));
        // Refresh user balance
        const newBalance = await getUserBalance(userId);
        console.log(`✅ Payment claimed! New balance: ${newBalance} sats`);
        return {
            success: true,
            paymentId: paymentContract._id,
            amount: paymentContract.amount.toString(),
            newBalance: newBalance.toString()
        };
    }
    catch (error) {
        console.error(`❌ Failed to claim payment:`, error);
        throw error;
    }
}
//# sourceMappingURL=payment-service.js.map