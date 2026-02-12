/**
 * Quiz Access Service
 * Business logic for quiz access with entry fee payment (EXEC pattern)
 */
import { prisma } from '@bizz/database';
import { Transaction } from '@bitcoin-computer/lib';
import { QuizAccessHelper, PaymentHelper, QuizRedemptionHelper } from '@bizz/sdk';
const { SIGHASH_SINGLE, SIGHASH_ANYONECANPAY } = Transaction;
// Mock Payment class for partial signing
class PaymentMock {
    constructor(satoshis, recipient, purpose, reference) {
        const mockedRev = `mock-${'0'.repeat(64)}:0`;
        this._id = mockedRev;
        this._rev = mockedRev;
        this._root = mockedRev;
        this._satoshis = satoshis;
        this._owners = recipient ? [recipient] : [];
        this.recipient = recipient || '';
        this.amount = satoshis;
        this.purpose = purpose || 'Entry Fee';
        this.reference = reference || '';
    }
    transfer(to) {
        this._owners = [to];
    }
}
export class QuizAccessService {
    /**
     * Step 3a: Prepare quiz access transaction
     * Teacher creates partially signed exec transaction with mock payment
     */
    static async prepareAccess(teacherComputer, params) {
        try {
            const { quizId } = params;
            // Get quiz from database
            const quiz = await prisma.quiz.findUnique({
                where: { contractId: quizId }
            });
            if (!quiz) {
                return { success: false, error: 'Quiz not found' };
            }
            const teacherPubKey = teacherComputer.getPublicKey();
            // Sync latest quiz state
            const [latestQuizRev] = await teacherComputer.query({ ids: [quizId] });
            const quizContract = await teacherComputer.sync(latestQuizRev);
            // Create mock payment
            const paymentMock = new PaymentMock(quiz.entryFee, teacherPubKey, 'Entry Fee', quizId);
            // Create partial exec transaction
            const accessHelper = new QuizAccessHelper(teacherComputer);
            const { tx: partialExecTx } = await accessHelper.createQuizAccessTx(quizContract, paymentMock, SIGHASH_SINGLE | SIGHASH_ANYONECANPAY);
            return {
                success: true,
                partialExecTx: partialExecTx.toHex(), // Serialize to hex
                quiz: {
                    id: quizId,
                    symbol: quiz.symbol,
                    entryFee: quiz.entryFee.toString(),
                    prizePool: quiz.prizePool.toString()
                }
            };
        }
        catch (error) {
            console.error('Error in prepareAccess service:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to prepare access'
            };
        }
    }
    /**
     * Step 3b: Complete quiz access
     * Student creates payment, completes exec, redeems token, teacher claims entry fee
     */
    static async completeAccess(studentComputer, teacherComputer, params) {
        try {
            const { studentId, quizId, attemptId, partialExecTx } = params;
            // Get quiz and attempt
            const [quiz, attempt] = await Promise.all([
                prisma.quiz.findUnique({ where: { contractId: quizId } }),
                prisma.quizAttempt.findUnique({ where: { contractId: attemptId } })
            ]);
            if (!quiz)
                return { success: false, error: 'Quiz not found' };
            if (!attempt)
                return { success: false, error: 'Attempt not found' };
            const teacherPubKey = teacherComputer.getPublicKey();
            // STEP 1: Student creates entry fee payment
            const paymentHelper = new PaymentHelper(studentComputer);
            const { tx: paymentTx, effect: paymentEffect } = await paymentHelper.createPayment({
                recipient: teacherPubKey,
                amount: quiz.entryFee,
                purpose: 'Entry Fee',
                reference: quizId
            });
            await studentComputer.broadcast(paymentTx);
            const entryPayment = paymentEffect.res;
            // STEP 2: Complete exec transaction
            // Deserialize transaction from hex
            const execTx = Transaction.fromHex(partialExecTx);
            const [paymentTxId, paymentIndex] = entryPayment._rev.split(':');
            execTx.updateInput(1, { txId: paymentTxId, index: parseInt(paymentIndex, 10) });
            execTx.updateOutput(1, { scriptPubKey: studentComputer.toScriptPubKey() });
            await studentComputer.fund(execTx);
            await studentComputer.sign(execTx);
            const execTxId = await studentComputer.broadcast(execTx);
            // Query for student's quiz token
            const [studentQuizRev] = await studentComputer.query({
                publicKey: studentComputer.getPublicKey()
            });
            const studentQuizToken = await studentComputer.sync(studentQuizRev);
            // STEP 3: Redeem quiz token
            const [latestAttemptRev] = await studentComputer.query({ ids: [attemptId] });
            const syncedAttempt = await studentComputer.sync(latestAttemptRev);
            const redemptionHelper = new QuizRedemptionHelper(studentComputer);
            const { tx: redeemTx, effect: redeemEffect } = await redemptionHelper.redeemQuizToken(studentQuizToken, syncedAttempt);
            const redeemTxId = await studentComputer.broadcast(redeemTx);
            const [, validatedAttempt] = redeemEffect.res;
            // STEP 4: Teacher claims entry fee
            const [teacherEntryPaymentRev] = await teacherComputer.query({ ids: [entryPayment._id] });
            const teacherEntryPayment = await teacherComputer.sync(teacherEntryPaymentRev);
            const teacherPaymentHelper = new PaymentHelper(teacherComputer);
            const { tx: claimTx } = await teacherPaymentHelper.claimPayment(teacherEntryPayment);
            await teacherComputer.broadcast(claimTx);
            // Update database
            await prisma.quizAttempt.update({
                where: { id: attempt.id },
                data: {
                    quizTokenRev: studentQuizToken._rev,
                    status: 'OWNED'
                }
            });
            return {
                success: true,
                attemptId: validatedAttempt._id,
                attemptRev: validatedAttempt._rev,
                execTxId,
                redeemTxId
            };
        }
        catch (error) {
            console.error('Error in completeAccess service:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to complete access'
            };
        }
    }
}
//# sourceMappingURL=quiz-access.service.js.map