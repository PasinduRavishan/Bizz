// Deployment-ready SeatRedemption contract (no imports, Contract is available in Bitcoin Computer context)
// Auto-generated from TypeScript source - DO NOT EDIT MANUALLY
// Edit the TypeScript file in src/SeatRedemption.ts instead

/**
 * SeatRedemption - Redeem seat token for QuizAttempt
 *
 * Allows students to burn their seat token when creating a QuizAttempt.
 * This enforces 1 SEAT = 1 QuizAttempt (seat is consumed on use).
 *
 * Flow:
 * 1. Student owns 1 SeatToken (purchased via SeatAccess.exec)
 * 2. Student calls SeatRedemption.redeem() with their seat and a QuizAttempt
 * 3. SeatToken is burned (amount = 0)
 * 4. QuizAttempt ownership is validated and returned
 *
 * Benefits:
 * - Enforces seat consumption (can't reuse seats)
 * - 1 seat = 1 attempt maximum
 * - Students create attempts only when ready to take quiz
 */
export class SeatRedemption extends Contract {
    /**
     * Redeem seat token to authorize quiz attempt creation
     *
     * @param seatToken - SeatToken owned by student (must have amount = 1)
     * @param quizAttempt - QuizAttempt created by student
     * @returns Tuple of [burned seatToken, validated QuizAttempt]
     */
    static redeem(seatToken, quizAttempt) {
        const [student] = seatToken._owners;
        if (!student) {
            throw new Error('Seat token must be owned by student');
        }
        if (seatToken.amount !== 1n) {
            throw new Error('Must have exactly 1 seat token to redeem');
        }
        if (seatToken.symbol !== 'SEAT') {
            throw new Error('Invalid seat token symbol');
        }
        const [attemptOwner] = quizAttempt._owners;
        if (attemptOwner !== student) {
            throw new Error('QuizAttempt must be owned by seat token owner');
        }
        if (quizAttempt.quizRef !== seatToken.quizRef) {
            throw new Error('QuizAttempt must be for the same quiz as the seat');
        }
        if (quizAttempt.status !== 'owned') {
            throw new Error('QuizAttempt must be in owned status');
        }
        seatToken.burn();
        quizAttempt.markAsRedeemed();
        return [seatToken, quizAttempt];
    }
}
