/**
 * Wallet Service
 *
 * Handles custodial wallet operations including:
 * - Mnemonic generation
 * - Wallet balance checking
 * - Wallet funding
 */
/**
 * Generate a BIP39 mnemonic phrase (12 words)
 * Uses the bip39 library from Bitcoin Computer
 *
 * @returns 12-word mnemonic phrase
 */
export declare function generateMnemonic(): Promise<string>;
/**
 * Get Bitcoin Computer instance for a user's wallet
 *
 * @param userId - User ID to get wallet for
 * @returns Computer instance configured with user's wallet
 */
export declare function getUserWallet(userId: string): Promise<import("@bitcoin-computer/lib").Computer>;
/**
 * Get user's wallet balance and update in database
 *
 * @param userId - User ID to check balance for
 * @returns Balance in satoshis
 */
export declare function getUserBalance(userId: string): Promise<bigint>;
/**
 * Fund a user's wallet from the server funding wallet
 * Used to give new users starter funds for gas fees
 *
 * @param userId - User ID to fund
 * @param amount - Amount in satoshis (unused in regtest, faucet gives fixed amount)
 * @returns Transaction ID or 'faucet' for regtest
 */
export declare function fundUserWallet(userId: string, amount: number): Promise<string>;
/**
 * Initialize wallet for a new user
 * Generates mnemonic, encrypts it, and funds with starter amount
 *
 * @param userId - User ID to initialize wallet for
 * @returns User's wallet address
 */
export declare function initializeUserWallet(userId: string): Promise<{
    address: string;
    publicKey: string;
}>;
//# sourceMappingURL=wallet-service.d.ts.map