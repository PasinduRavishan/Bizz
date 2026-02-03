// Deployment-ready QuizRedemption contract (no imports, Contract is available in Bitcoin Computer context)
// Auto-generated from TypeScript source - DO NOT EDIT MANUALLY
// Edit the TypeScript file in src/QuizRedemption.ts instead

/**
 * QuizRedemption - Convert Quiz Token → QuizAttempt
 *
 * Student redeems their Quiz fungible token to create/unlock a QuizAttempt.
 * This enforces that students MUST own a quiz token before submitting answers.
 *
 * Process:
 * 1. Student owns 1 Quiz token (received via QuizAccess.exec)
 * 2. Student creates QuizAttempt (owned status)
 * 3. Student calls QuizRedemption.redeem(quizToken, quizAttempt)
 * 4. Quiz token gets burned (amount set to 0)
 * 5. QuizAttempt marked as redeemed (isRedeemed = true)
 * 6. Student can now submit answers
 *
 * Security:
 * - Prevents students from creating multiple attempts with one quiz token
 * - Ensures quiz token ownership before allowing quiz attempts
 * - Burns quiz token to prevent reuse
 */
export class QuizRedemption extends Contract {
    /**
     * Redeem quiz token to unlock quiz attempt
     *
     * @param quizToken - Student's Quiz fungible token (must own 1)
     * @param quizAttempt - Student's QuizAttempt (must be owned status)
     * @returns [Burned quiz token, Redeemed quiz attempt]
     */
    static redeem(quizToken, quizAttempt) {
        const [student] = quizToken._owners;
        if (!student) {
            throw new Error('Quiz token must be owned by student');
        }
        if (quizToken.amount !== 1n) {
            throw new Error('Must have exactly 1 quiz token to redeem');
        }
        if (!quizToken.symbol) {
            throw new Error('Invalid quiz token symbol');
        }
        const [attemptOwner] = quizAttempt._owners;
        if (attemptOwner !== student) {
            throw new Error('QuizAttempt must be owned by quiz token owner');
        }
        const quizId = quizToken.originalQuizId || quizToken._id;
        if (quizAttempt.quizRef !== quizId) {
            throw new Error('QuizAttempt must be for the same quiz as the token');
        }
        if (quizAttempt.status !== 'owned') {
            throw new Error('QuizAttempt must be in owned status');
        }
        if (quizAttempt.quizTeacher !== quizToken.teacher) {
            throw new Error('QuizAttempt teacher must match quiz token teacher');
        }
        quizToken.burn();
        quizAttempt.markAsRedeemed();
        return [quizToken, quizAttempt];
    }
}
