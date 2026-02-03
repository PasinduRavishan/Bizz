// Deployment-ready SeatToken contract (no imports, Contract is available in Bitcoin Computer context)
// Auto-generated from TypeScript source - DO NOT EDIT MANUALLY
// Edit the TypeScript file in src/SeatToken.ts instead

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
export class SeatToken extends Contract {
    constructor(to, amount, symbol, quizRef) {
        if (!to)
            throw new Error('Recipient public key required');
        if (amount <= 0n)
            throw new Error('Amount must be positive');
        if (!symbol)
            throw new Error('Symbol required');
        if (!quizRef)
            throw new Error('Quiz reference required');
        super({
            _owners: [to],
            amount,
            symbol,
            quizRef
        });
    }
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
    transfer(recipient, amount) {
        if (!recipient)
            throw new Error('Recipient required');
        if (amount <= 0n)
            throw new Error('Amount must be positive');
        if (this.amount < amount)
            throw new Error('Insufficient balance');
        this.amount -= amount;
        return new SeatToken(recipient, amount, this.symbol, this.quizRef);
    }
    /**
     * Burn seat token by setting amount to 0
     * Used when redeeming seat for quiz attempt
     */
    burn() {
        if (this.amount !== 1n) {
            throw new Error('Can only burn exactly 1 seat token');
        }
        this.amount = 0n;
    }
}
