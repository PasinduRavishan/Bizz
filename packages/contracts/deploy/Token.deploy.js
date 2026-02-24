// Deployment-ready Token contract (no imports, Contract is available in Bitcoin Computer context)
// Auto-generated from TypeScript source - DO NOT EDIT MANUALLY
// Edit the TypeScript file in src/Token.ts instead

export class Token extends Contract {
    constructor(to, amount, symbol, additionalProps) {
        if (!to)
            throw new Error('Recipient public key required');
        if (amount <= 0n)
            throw new Error('Amount must be positive');
        if (!symbol)
            throw new Error('Symbol required');
        super({
            _owners: [to],
            _satoshis: BigInt(546), // Dust limit - token value is in amount, not satoshis
            amount,
            symbol,
            ...additionalProps
        });
    }
    mint(to, amount) {
        if (!to)
            throw new Error('Recipient required');
        if (amount <= 0n)
            throw new Error('Amount must be positive');
        throw new Error('mint() must be implemented by subclass');
    }
    transfer(recipient, amount) {
        if (!recipient)
            throw new Error('Recipient required');
        if (amount <= 0n)
            throw new Error('Amount must be positive');
        if (this.amount < amount)
            throw new Error('Insufficient balance');
        this.amount -= amount;
        throw new Error('transfer() must be implemented by subclass');
    }
    burn() {
        if (this.amount <= 0n) {
            throw new Error('No tokens to burn');
        }
        this.amount = 0n;
    }
    balanceOf() {
        return this.amount;
    }
    totalSupply() {
        return this.amount;
    }
}
