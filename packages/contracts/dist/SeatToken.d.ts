import { Contract } from '@bitcoin-computer/lib';
/**
 * SeatToken - TBC20 Fungible Token for Quiz Seats
 *
 * Represents available quiz attempt slots that can be purchased by students.
 * Uses the TBC20 pattern (like ERC20) where tokens can be split and transferred.
 *
 * Flow:
 * 1. Teacher mints N seat tokens (e.g., 100 seats for the quiz)
 * 2. Students purchase seats via exec pattern (atomic swap: payment for seat)
 * 3. Students redeem seats to receive QuizAttempt NFTs
 */
export declare class SeatToken extends Contract {
    amount: bigint;
    symbol: string;
    quizRef: string;
    _owners: string[];
    constructor(to: string, amount: bigint, symbol: string, quizRef: string);
    /**
     * Transfer seat tokens to another user
     *
     * This follows the TBC20 pattern:
     * - Reduces THIS utxo's amount
     * - Creates NEW utxo for recipient with specified amount
     *
     * Example:
     * Teacher has: { amount: 100, owner: teacher }
     * After transfer(student, 1):
     * - Teacher: { amount: 99, owner: teacher }
     * - Student: { amount: 1, owner: student } [NEW UTXO]
     */
    transfer(recipient: string, amount: bigint): SeatToken;
}
//# sourceMappingURL=SeatToken.d.ts.map