/**
 * Server-side Bitcoin Computer Service
 *
 * Provides server-side Bitcoin Computer operations using env mnemonics.
 * This matches the test flow exactly from tbc20.test.ts
 */
import { Computer } from '@bitcoin-computer/lib';
/**
 * Create a Bitcoin Computer instance
 * Uses environment variables by default
 */
export function createBitcoinComputer(config) {
    const computerConfig = {
        chain: config?.chain || process.env.NEXT_PUBLIC_BITCOIN_COMPUTER_CHAIN || 'LTC',
        network: config?.network || process.env.NEXT_PUBLIC_BITCOIN_COMPUTER_NETWORK || 'regtest',
        url: config?.url || process.env.NEXT_PUBLIC_BITCOIN_COMPUTER_URL,
        mnemonic: config?.mnemonic || process.env.BITCOIN_COMPUTER_MNEMONIC,
        ...(config?.path && { path: config.path })
    };
    return new Computer(computerConfig);
}
/**
 * Get teacher's Bitcoin Computer instance
 */
export function getTeacherComputer() {
    return createBitcoinComputer({
        mnemonic: process.env.BITCOIN_COMPUTER_MNEMONIC,
        path: "m/44'/1'/0'/0/0" // Teacher path
    });
}
/**
 * Get student's Bitcoin Computer instance
 * In production, this would use the student's mnemonic from session/database
 * For now, using test paths
 */
export function getStudentComputer(studentIndex = 1) {
    return createBitcoinComputer({
        mnemonic: process.env.BITCOIN_COMPUTER_MNEMONIC,
        path: `m/44'/1'/0'/0/${studentIndex}` // Student path
    });
}
/**
 * Wait for mempool (for testing)
 */
export async function waitForMempool(ms = 1000) {
    await new Promise(resolve => setTimeout(resolve, ms));
}
/**
 * Mine blocks (regtest only)
 */
export async function mineBlocks(computer, blocks = 1) {
    if (process.env.NEXT_PUBLIC_BITCOIN_COMPUTER_NETWORK === 'regtest') {
        console.log(`    Mining ${blocks} block(s)...`);
        // Note: Bitcoin Computer lib handles mining internally on regtest
        await waitForMempool(blocks * 1000);
    }
}
//# sourceMappingURL=bitcoin-computer-server.js.map