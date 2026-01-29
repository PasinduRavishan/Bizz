// Deployment-ready PrizeSwap contract (no imports, Contract is available in Bitcoin Computer context)
// Auto-generated from TypeScript source - DO NOT EDIT MANUALLY
// Edit the TypeScript file in src/PrizeSwap.ts instead

export class PrizeSwap extends Contract {
    /**
     * Atomic swap: Student gives answer proof and receives prize payment
     *
     * NOTE: Entry fees already collected in Phase 1 (AttemptAccess.exec)
     * This swap exchanges prize for answer proof only
     *
     * @param prizePayment - Payment contract from teacher (prize amount)
     * @param answerProof - AnswerProof contract from student (their answers)
     * @param attempt - QuizAttempt contract
     * @returns [prizePayment, answerProof, attempt] with updated ownership
     */
    static swap(prizePayment, answerProof, attempt) {
        const [student] = attempt._owners;
        const [proofOwner] = answerProof._owners;
        if (student !== prizePayment.recipient) {
            throw new Error('Prize payment must be addressed to attempt owner');
        }
        if (proofOwner !== student) {
            throw new Error('Answer proof must be owned by student');
        }
        if (answerProof.attemptRef !== attempt._id) {
            throw new Error('Answer proof must match the attempt');
        }
        if (attempt.status !== 'verified') {
            throw new Error('Attempt must be verified before claiming prize');
        }
        if (!attempt.passed) {
            throw new Error('Only passing attempts can claim prizes');
        }
        if (!answerProof.passed) {
            throw new Error('Answer proof must show student passed');
        }
        const teacher = attempt.quizTeacher;
        prizePayment.transfer(student); // Student receives prize
        answerProof.transfer(teacher); // Teacher receives answer proof
        attempt.claimPrize();
        return [prizePayment, answerProof, attempt];
    }
}
