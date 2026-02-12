import { Computer } from '@bitcoin-computer/lib';
/**
 * Create a Bitcoin Computer instance with regtest configuration
 *
 * @param options - Optional configuration overrides
 * @returns Configured Computer instance
 */
export function createComputer(options = {}) {
    const config = {
        chain: 'LTC',
        network: 'regtest',
        url: 'https://rltc.node.bitcoincomputer.io',
        ...options
    };
    console.log('🔧 Bitcoin Computer Configuration:');
    console.log('   Chain:', config.chain);
    console.log('   Network:', config.network);
    console.log('   URL:', config.url);
    return new Computer(config);
}
/**
 * Create a Computer instance from environment variables
 */
export function createComputerFromEnv() {
    return new Computer({
        chain: (process.env.NEXT_PUBLIC_BITCOIN_COMPUTER_CHAIN || 'LTC'),
        network: (process.env.NEXT_PUBLIC_BITCOIN_COMPUTER_NETWORK || 'regtest'),
        url: process.env.NEXT_PUBLIC_BITCOIN_COMPUTER_URL || 'https://rltc.node.bitcoincomputer.io'
    });
}
/**
 * Get Bitcoin Computer configuration from environment
 */
export function getComputerConfig() {
    return {
        chain: process.env.NEXT_PUBLIC_BITCOIN_COMPUTER_CHAIN || 'LTC',
        network: process.env.NEXT_PUBLIC_BITCOIN_COMPUTER_NETWORK || 'regtest',
        url: process.env.NEXT_PUBLIC_BITCOIN_COMPUTER_URL || 'https://rltc.node.bitcoincomputer.io',
        platformFee: Number(process.env.NEXT_PUBLIC_PLATFORM_FEE) || 0.02,
        minEntryFee: Number(process.env.NEXT_PUBLIC_MIN_ENTRY_FEE) || 5000
    };
}
// Export Computer class for direct use
export { Computer };
//# sourceMappingURL=bitcoin-computer.js.map