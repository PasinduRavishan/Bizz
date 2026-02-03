// Deployment-ready QuizAccess contract (no imports, Contract is available in Bitcoin Computer context)
// Auto-generated from TypeScript source - DO NOT EDIT MANUALLY
// Edit the TypeScript file in src/QuizAccess.ts instead

/**
 * QuizAccess - Atomic Quiz Purchase (EXEC Pattern)
 *
 * Enables atomic swap:
 * - Teacher gives Quiz fungible token (1 quiz token)
 * - Student pays entry fee (Payment contract)
 *
 * Uses SIGHASH_SINGLE | SIGHASH_ANYONECANPAY for partial signing:
 * 1. Teacher creates Quiz token and mock Payment
 * 2. Teacher partially signs with their input (quiz token)
 * 3. Student creates real Payment
 * 4. Student updates transaction with real payment UTXO
 * 5. Student funds, signs, and broadcasts
 * 6. Atomic execution: both transfers happen or neither happens
 *
 * Result:
 * - Student receives 1 Quiz token
 * - Teacher receives entry fee Payment
 */
export class QuizAccess extends Contract {
    /**
     * Execute atomic quiz purchase
     *
     * @param quizToken - Teacher's Quiz fungible token
     * @param entryFeePayment - Student's entry fee Payment
     * @returns [Payment to teacher, Quiz token to student]
     */
    static exec(quizToken, entryFeePayment) {
        const [teacher] = quizToken._owners;
        const [student] = entryFeePayment._owners;
        if (quizToken.amount < 1n) {
            throw new Error('No available quiz tokens');
        }
        if (entryFeePayment.recipient !== teacher) {
            throw new Error('Entry fee must be paid to teacher');
        }
        if (entryFeePayment.purpose !== 'Entry Fee') {
            throw new Error('Payment must be for entry fee');
        }
        if (entryFeePayment.amount !== quizToken.entryFee) {
            throw new Error('Payment amount must match quiz entry fee');
        }
        entryFeePayment.transfer(teacher);
        const studentQuiz = quizToken.transfer(student, 1n);
        return [entryFeePayment, studentQuiz];
    }
}
