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
    mint(to: string, amount: bigint): Token;
    transfer(recipient: string, amount: bigint): Token;
    burn(): void;
    balanceOf(): bigint;
    totalSupply(): bigint;
}
//# sourceMappingURL=Token.d.ts.map