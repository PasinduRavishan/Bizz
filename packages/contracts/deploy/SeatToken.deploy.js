// Deployment-ready SeatToken contract (no imports, Contract is available in Bitcoin Computer context)
// Auto-generated from TypeScript source - DO NOT EDIT MANUALLY
// Edit the TypeScript file in src/SeatToken.ts instead

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
    burn() {
        if (this.amount !== 1n) {
            throw new Error('Can only burn exactly 1 seat token');
        }
        this.amount = 0n;
    }
}
