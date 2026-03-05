import { Computer } from '@bitcoin-computer/lib';

/**
 * ComputerManager - Singleton pattern for Computer instances
 *
 * Maintains a single Computer instance per user (identified by mnemonic)
 * to preserve UTXO state across multiple API requests.
 *
 * This matches the pattern used in tbc20.test.ts where Computer instances
 * are created once and reused throughout all operations.
 */
class ComputerManager {
  private static instance: ComputerManager;
  private computers: Map<string, Computer>;

  private constructor() {
    this.computers = new Map();
  }

  static getInstance(): ComputerManager {
    if (!ComputerManager.instance) {
      ComputerManager.instance = new ComputerManager();
    }
    return ComputerManager.instance;
  }

  /**
   * Get or create a Computer instance for a user
   * @param mnemonic - User's BIP39 mnemonic phrase
   * @returns Computer instance
   */
  getComputer(mnemonic: string | null): Computer {
    if (!mnemonic) {
      throw new Error('Mnemonic is required to create Computer instance');
    }

    // Use mnemonic as key to identify unique users
    if (!this.computers.has(mnemonic)) {
      console.log('  🔧 Creating new Computer instance for user');
      const computer = new Computer({
        chain: process.env.BC_CHAIN || 'LTC',
        network: process.env.BC_NETWORK || 'regtest',
        mnemonic,
      });
      this.computers.set(mnemonic, computer);
    } else {
      console.log('  ♻️  Reusing existing Computer instance for user');
    }

    return this.computers.get(mnemonic)!;
  }

  /**
   * Clear a specific user's Computer instance (optional cleanup)
   * @param mnemonic - User's mnemonic
   */
  clearComputer(mnemonic: string): void {
    this.computers.delete(mnemonic);
  }

  /**
   * Clear all Computer instances (optional cleanup)
   */
  clearAll(): void {
    this.computers.clear();
  }

  /**
   * Get statistics about cached instances
   */
  getStats(): { totalInstances: number; mnemonics: string[] } {
    return {
      totalInstances: this.computers.size,
      mnemonics: Array.from(this.computers.keys()).map(m => `${m.substring(0, 20)}...`),
    };
  }
}

export const computerManager = ComputerManager.getInstance();
