// TypeScript version for local development (not used for deployment)
// Bitcoin Computer requires JavaScript without imports
// For deployment, use the JS version or strip types
// @ts-expect-error - Bitcoin Computer library type definitions issue
import { Contract } from '@bitcoin-computer/lib';
/**
 * Token - Base class for TBC20 fungible tokens
 *
 * Implements the standard TBC20 pattern from Bitcoin Computer monorepo.
 * Pattern: class Token extends Contract with amount, symbol, _owners
 *
 * All fungible tokens should extend this base class.
 */
export class Token extends Contract {
    amount;
    symbol;
    _owners;
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
        // Subclass MUST override this to create proper token type
        throw new Error('mint() must be implemented by subclass');
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
        // Subclass MUST override this to create proper token type
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
//# sourceMappingURL=Token.js.map