import { Contract } from '@bitcoin-computer/lib';
/**
 * ITBC20 Interface
 * Standard interface for TBC20 fungible tokens (inspired by ERC20)
 * Based on Bitcoin Computer monorepo examples
 */
export interface ITBC20 {
    mint(to: string, amount: bigint): Token;
    totalSupply(): bigint;
    balanceOf(): bigint;
    transfer(recipient: string, amount: bigint): Token;
    burn(): void;
}
/**
 * Token - Base class for TBC20 fungible tokens
 *
 * Implements the standard TBC20 pattern from Bitcoin Computer monorepo.
 * Pattern: class Token extends Contract with amount, symbol, _owners
 *
 * All fungible tokens should extend this base class.
 */
export declare class Token extends Contract implements ITBC20 {
    amount: bigint;
    symbol: string;
    _owners: string[];
    constructor(to: string, amount: bigint, symbol: string, additionalProps?: Record<string, any>);
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
    mint(to: string, amount: bigint): Token;
    /**
     * Transfer tokens to recipient (TBC20 standard)
     * Creates new UTXO for recipient, reduces this token's amount
     * MUST be overridden by subclass to return correct type
     *
     * @param recipient - Recipient's public key
     * @param amount - Amount to transfer
     * @returns New token UTXO for recipient
     */
    transfer(recipient: string, amount: bigint): Token;
    /**
     * Burn tokens (destroy them)
     * Used during redemption or other destructive operations
     */
    burn(): void;
    /**
     * Get token balance (TBC20 interface)
     */
    balanceOf(): bigint;
    /**
     * Get total supply (returns current amount in this UTXO)
     * For global supply tracking, implement in subclass
     */
    totalSupply(): bigint;
}
//# sourceMappingURL=Token.d.ts.map