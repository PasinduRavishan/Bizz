// TypeScript version for local development (not used for deployment)
// Bitcoin Computer requires JavaScript without imports
// For deployment, use the JS version or strip types
// @ts-expect-error - Bitcoin Computer library type definitions issue
import { Contract } from '@bitcoin-computer/lib';
export class SeatToken extends Contract {
    amount;
    symbol;
    quizRef;
    _owners;
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
    transfer(recipient, amount) {
        if (!recipient)
            throw new Error('Recipient required');
        if (amount <= 0n)
            throw new Error('Amount must be positive');
        if (this.amount < amount)
            throw new Error('Insufficient balance');
        // Reduce this UTXO's balance
        this.amount -= amount;
        // Create new UTXO for recipient
        return new SeatToken(recipient, amount, this.symbol, this.quizRef);
    }
    burn() {
        if (this.amount !== 1n) {
            throw new Error('Can only burn exactly 1 seat token');
        }
        this.amount = 0n;
    }
}
//# sourceMappingURL=SeatToken.js.map