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
    /**
     * Transfer tokens to recipient (TBC20 standard)
     * Creates new UTXO for recipient, reduces this token's amount
     * MUST be overridden by subclass to return correct type
     *
     * @param recipient - Recipient's public key
     * @param amount - Amount to transfer
     * @returns New token UTXO for recipient
     */
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
    /**
     * Burn tokens (destroy them)
     * Used during redemption or other destructive operations
     */
    burn() {
        if (this.amount <= 0n) {
            throw new Error('No tokens to burn');
        }
        this.amount = 0n;
    }
    /**
     * Get token balance (TBC20 interface)
     */
    balanceOf() {
        return this.amount;
    }
    /**
     * Get total supply (returns current amount in this UTXO)
     * For global supply tracking, implement in subclass
     */
    totalSupply() {
        return this.amount;
    }
}
//# sourceMappingURL=Token.js.map