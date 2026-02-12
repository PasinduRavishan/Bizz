/**
 * Server-side Bitcoin Computer Service
 *
 * Provides server-side Bitcoin Computer operations using env mnemonics.
 * This matches the test flow exactly from tbc20.test.ts
 */
import { Computer } from '@bitcoin-computer/lib';
export interface BitcoinComputerConfig {
    chain?: string;
    network?: string;
    url?: string;
    mnemonic?: string;
    path?: string;
}
/**
 * Create a Bitcoin Computer instance
 * Uses environment variables by default
 */
export declare function createBitcoinComputer(config?: BitcoinComputerConfig): Computer;
/**
 * Get teacher's Bitcoin Computer instance
 */
export declare function getTeacherComputer(): Computer;
/**
 * Get student's Bitcoin Computer instance
 * In production, this would use the student's mnemonic from session/database
 * For now, using test paths
 */
export declare function getStudentComputer(studentIndex?: number): Computer;
/**
 * Wait for mempool (for testing)
 */
export declare function waitForMempool(ms?: number): Promise<void>;
/**
 * Mine blocks (regtest only)
 */
export declare function mineBlocks(computer: Computer, blocks?: number): Promise<void>;
//# sourceMappingURL=bitcoin-computer-server.d.ts.map