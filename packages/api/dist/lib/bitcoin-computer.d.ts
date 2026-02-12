import { Computer } from '@bitcoin-computer/lib';
/**
 * Bitcoin Computer Configuration
 * Using regtest for development
 */
interface ComputerConfig {
    chain?: 'LTC' | 'BTC' | 'DOGE';
    network?: 'mainnet' | 'testnet' | 'regtest';
    mnemonic?: string;
    url?: string;
    [key: string]: unknown;
}
/**
 * Create a Bitcoin Computer instance with regtest configuration
 *
 * @param options - Optional configuration overrides
 * @returns Configured Computer instance
 */
export declare function createComputer(options?: ComputerConfig): typeof Computer.prototype;
/**
 * Create a Computer instance from environment variables
 */
export declare function createComputerFromEnv(): typeof Computer.prototype;
/**
 * Get Bitcoin Computer configuration from environment
 */
export declare function getComputerConfig(): {
    chain: string;
    network: string;
    url: string;
    platformFee: number;
    minEntryFee: number;
};
export { Computer };
//# sourceMappingURL=bitcoin-computer.d.ts.map