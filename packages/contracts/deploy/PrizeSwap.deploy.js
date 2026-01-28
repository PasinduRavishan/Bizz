// Deployment-ready PrizeSwap contract (no imports, Contract is available in Bitcoin Computer context)
// Auto-generated from TypeScript source - DO NOT EDIT MANUALLY
// Edit the TypeScript file in src/PrizeSwap.ts instead

export class PrizeSwap extends Contract {
    /**
     * Atomic swap: Student pays entry fee and receives prize payment
     *
     * @param prizePayment - Payment contract from teacher (prize amount)
     * @param entryFeePayment - Payment contract from student (entry fee)
     * @param attempt - QuizAttempt contract
     * @returns [prizePayment, entryFeePayment, attempt] with updated ownership
     */
    static swap(prizePayment, entryFeePayment, attempt) {
        const [student] = attempt._owners;
        const [entryFeePayer] = entryFeePayment._owners;
        if (student !== prizePayment.recipient) {
            throw new Error('Prize payment must be addressed to attempt owner');
        }
        if (entryFeePayer !== student) {
            throw new Error('Entry fee must be paid by student');
        }
        if (attempt.status !== 'verified') {
            throw new Error('Attempt must be verified before claiming prize');
        }
        if (!attempt.passed) {
            throw new Error('Only passing attempts can claim prizes');
        }
        const teacher = attempt.quizTeacher;
        prizePayment.transfer(student); // Student receives prize
        entryFeePayment.transfer(teacher); // Teacher receives entry fee
        attempt.claimPrize();
        return [prizePayment, entryFeePayment, attempt];
    }
}
