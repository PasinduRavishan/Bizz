// Deployment-ready Token contract (no imports, Contract is available in Bitcoin Computer context)
// Auto-generated from TypeScript source - DO NOT EDIT MANUALLY
// Edit the TypeScript file in src/Token.ts instead

/**
 * Token - Base class for TBC20 fungible tokens
 *
 * Implements the standard TBC20 pattern from Bitcoin Computer monorepo.
 * Pattern: class Token extends Contract with amount, symbol, _owners
 *
 * All fungible tokens should extend this base class.
 */
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
    /**
     * Mint new tokens (TBC20 standard)
     * Creates NEW tokens for recipient without reducing sender's balance
     * This is true on-demand minting - creates tokens from nothing
     * MUST be overridden by subclass to return correct type
     *
     * @param to - Recipient's public key
     * @param amount - Amount to mint
     * @returns New token UTXO for recipient
     */
    mint(to, amount) {
        if (!to)
            throw new Error('Recipient required');
        if (amount <= 0n)
            throw new Error('Amount must be positive');
        throw new Error('mint() must be implemented by subclass');
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
        this.amount -= amount;
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
