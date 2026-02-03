import { Contract } from '@bitcoin-computer/lib';
interface SeatToken extends Contract {
    _owners: string[];
    _satoshis: bigint;
    amount: bigint;
    symbol: string;
    quizRef: string;
    burn(): void;
}
interface QuizAttempt extends Contract {
    _id: string;
    _owners: string[];
    student: string;
    quizRef: string;
    answerCommitment: string;
    quizTeacher: string;
    entryFee: bigint;
    score: number | null;
    passed: boolean | null;
    status: string;
    submitTimestamp: number;
    claimedAt: number | null;
    version: string;
    isRedeemed: boolean;
    markAsRedeemed(): void;
}
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
export declare class SeatRedemption extends Contract {
    /**
     * Redeem seat token to authorize quiz attempt creation
     *
     * @param seatToken - SeatToken owned by student (must have amount = 1)
     * @param quizAttempt - QuizAttempt created by student
     * @returns Tuple of [burned seatToken, validated QuizAttempt]
     */
    static redeem(seatToken: SeatToken, quizAttempt: QuizAttempt): [SeatToken, QuizAttempt];
}
export {};
//# sourceMappingURL=SeatRedemption.d.ts.map