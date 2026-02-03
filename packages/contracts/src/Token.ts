// TypeScript version for local development (not used for deployment)
// Bitcoin Computer requires JavaScript without imports
// For deployment, use the JS version or strip types
// @ts-expect-error - Bitcoin Computer library type definitions issue
import { Contract } from '@bitcoin-computer/lib'

/**
 * ITBC20 Interface
 * Standard interface for TBC20 fungible tokens (inspired by ERC20)
 * Based on Bitcoin Computer monorepo examples
 */
export interface ITBC20 {
  mint?(to: string, amount: bigint): Promise<Token>
  totalSupply?(): bigint
  balanceOf?(): bigint
  transfer(recipient: string, amount: bigint): Token
  burn?(): void
}

/**
 * Token - Base class for TBC20 fungible tokens
 *
 * Implements the standard TBC20 pattern from Bitcoin Computer monorepo.
 * Pattern: class Token extends Contract with amount, symbol, _owners
 *
 * All fungible tokens should extend this base class.
 */
export class Token extends Contract implements ITBC20 {
  amount!: bigint
  symbol!: string
  _owners!: string[]

  constructor(to: string, amount: bigint, symbol: string, additionalProps?: Record<string, any>) {
    if (!to) throw new Error('Recipient public key required')
    if (amount <= 0n) throw new Error('Amount must be positive')
    if (!symbol) throw new Error('Symbol required')

    super({
      _owners: [to],
      _satoshis: BigInt(546), // Dust limit - token value is in amount, not satoshis
      amount,
      symbol,
      ...additionalProps
    })
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
  transfer(recipient: string, amount: bigint): Token {
    if (!recipient) throw new Error('Recipient required')
    if (amount <= 0n) throw new Error('Amount must be positive')
    if (this.amount < amount) throw new Error('Insufficient balance')

    // Reduce this UTXO's balance
    this.amount -= amount

    // Subclass MUST override this to create proper token type
    throw new Error('transfer() must be implemented by subclass')
  }

  /**
   * Burn tokens (destroy them)
   * Used during redemption or other destructive operations
   */
  burn(): void {
    if (this.amount <= 0n) {
      throw new Error('No tokens to burn')
    }
    this.amount = 0n
  }

  /**
   * Get token balance (TBC20 interface)
   */
  balanceOf(): bigint {
    return this.amount
  }

  /**
   * Get total supply (returns current amount in this UTXO)
   * For global supply tracking, implement in subclass
   */
  totalSupply(): bigint {
    return this.amount
  }
}
