// TypeScript version for local development (not used for deployment)
// Bitcoin Computer requires JavaScript without imports
// For deployment, use the JS version or strip types
// @ts-expect-error - Bitcoin Computer library type definitions issue
import { Contract } from '@bitcoin-computer/lib';
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
        // Validation: Student must own the seat token
        if (!student) {
            throw new Error('Seat token must be owned by student');
        }
        // Validation: Must have exactly 1 seat
        if (seatToken.amount !== 1n) {
            throw new Error('Must have exactly 1 seat token to redeem');
        }
        // Validation: Check symbol
        if (seatToken.symbol !== 'SEAT') {
            throw new Error('Invalid seat token symbol');
        }
        // Validation: QuizAttempt must be owned by same student
        const [attemptOwner] = quizAttempt._owners;
        if (attemptOwner !== student) {
            throw new Error('QuizAttempt must be owned by seat token owner');
        }
        // Validation: QuizAttempt must be for the same quiz as the seat
        if (quizAttempt.quizRef !== seatToken.quizRef) {
            throw new Error('QuizAttempt must be for the same quiz as the seat');
        }
        // Validation: QuizAttempt must be in 'owned' status (not yet used)
        if (quizAttempt.status !== 'owned') {
            throw new Error('QuizAttempt must be in owned status');
        }
        // BURN the seat token by calling burn method
        // This sets amount to 0, making it unusable
        seatToken.burn();
        // MARK the attempt as redeemed
        // This allows the student to submit answers
        quizAttempt.markAsRedeemed();
        // Return burned seat and validated attempt
        // The student can now use the attempt to submit answers
        return [seatToken, quizAttempt];
    }
}
//# sourceMappingURL=SeatRedemption.js.map