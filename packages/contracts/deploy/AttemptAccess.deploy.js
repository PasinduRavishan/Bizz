// Deployment-ready AttemptAccess contract (no imports, Contract is available in Bitcoin Computer context)
// Auto-generated from TypeScript source - DO NOT EDIT MANUALLY
// Edit the TypeScript file in src/AttemptAccess.ts instead

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
        const [teacher] = attempt._owners;
        const [student] = entryFeePayment._owners;
        if (attempt.answerCommitment !== '') {
            throw new Error('Attempt already has answers committed');
        }
        if (attempt.status !== 'available') {
            throw new Error('Attempt not available for purchase');
        }
        if (entryFeePayment._satoshis < attempt.entryFee) {
            throw new Error('Insufficient entry fee payment');
        }
        if (entryFeePayment.recipient !== teacher) {
            throw new Error('Entry fee must be paid to teacher');
        }
        attempt.transfer(student); // Student now owns attempt
        entryFeePayment.transfer(teacher); // Teacher now owns entry fee
        return [entryFeePayment, attempt];
    }
}
