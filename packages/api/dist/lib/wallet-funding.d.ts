/**
 * Wallet Funding Helper
 *
 * Ensures teacher wallets have spendable UTXOs for contract deployment
 */
/**
 * Ensure user has spendable UTXOs for transactions
 *
 * @param userId - User ID to check and fund
 * @param minAmount - Minimum amount needed in satoshis (default: 100000 = 0.001 LTC)
 * @param skipCheck - Skip UTXO check (for regtest when all funds locked in contracts)
 * @returns true if wallet has UTXOs, throws if unable to fund
 */
export declare function ensureWalletHasUTXOs(userId: string, minAmount?: number, skipCheck?: boolean): Promise<boolean>;
/**
 * Check if wallet needs funding before operation
 * Returns true if ready, false if needs funding
 */
export declare function checkWalletReady(userId: string): Promise<{
    ready: boolean;
    balance: bigint;
    utxos: number;
}>;
//# sourceMappingURL=wallet-funding.d.ts.map