// @ts-expect-error - Bitcoin Computer library type definitions issue
import { Contract } from '@bitcoin-computer/lib';
export class AttemptAccess extends Contract {
    /**
     * Atomic exec: Student pays entry fee to access quiz attempt
     *
     * Flow:
     * 1. Teacher creates empty QuizAttempt (owned by teacher)
     * 2. Teacher creates partially signed transaction with mocked entry fee Payment
     * 3. Student creates real entry fee Payment
     * 4. Student completes transaction → atomic swap
     *
     * @param attempt - Empty QuizAttempt owned by teacher
     * @param entryFeePayment - Payment from student (entry fee amount)
     * @returns [entryFeePayment, attempt] with updated ownership
     */
    static exec(attempt, entryFeePayment) {
        // Get current owners
        const [teacher] = attempt._owners;
        const [student] = entryFeePayment._owners;
        // Validation 1: Attempt must be unused (empty commitment)
        if (attempt.answerCommitment !== '') {
            throw new Error('Attempt already has answers committed');
        }
        // Validation 2: Attempt must be in 'available' status
        if (attempt.status !== 'available') {
            throw new Error('Attempt not available for purchase');
        }
        // Validation 3: Entry fee payment must match required amount
        if (entryFeePayment._satoshis < attempt.entryFee) {
            throw new Error('Insufficient entry fee payment');
        }
        // Validation 4: Entry fee payment recipient must be teacher
        if (entryFeePayment.recipient !== teacher) {
            throw new Error('Entry fee must be paid to teacher');
        }
        // Atomic swap: Exchange ownership
        attempt.transfer(student); // Student now owns attempt
        entryFeePayment.transfer(teacher); // Teacher now owns entry fee
        // Return order matters for UTXO outputs
        return [entryFeePayment, attempt];
    }
}
//# sourceMappingURL=AttemptAccess.js.map