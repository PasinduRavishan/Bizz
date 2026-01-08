// @ts-ignore
import { Computer } from '@bitcoin-computer/lib'

/**
 * Bitcoin Computer Configuration
 * Using regtest for development
 */

interface ComputerConfig {
  chain?: 'LTC' | 'BTC' | 'DOGE'
  network?: 'mainnet' | 'testnet' | 'regtest'
  mnemonic?: string
  url?: string
  [key: string]: any  // Allow additional properties
}

/**
 * Create a Bitcoin Computer instance with regtest configuration
 * 
 * @param options - Optional configuration overrides
 * @returns Configured Computer instance
 */
export function createComputer(options: ComputerConfig = {}): typeof Computer.prototype {
  const config: ComputerConfig = {
    chain: 'LTC',
    network: 'regtest',
    url: 'https://rltc.node.bitcoincomputer.io',
    ...options
  }

  console.log('🔧 Bitcoin Computer Configuration:')
  console.log('   Chain:', config.chain)
  console.log('   Network:', config.network)
  console.log('   URL:', config.url)

  return new Computer(config) as any
}

/**
 * Create a Computer instance from environment variables
 */
export function createComputerFromEnv(): typeof Computer.prototype {
  return new Computer({
    chain: (process.env.NEXT_PUBLIC_BITCOIN_COMPUTER_CHAIN || 'LTC') as any,
    network: (process.env.NEXT_PUBLIC_BITCOIN_COMPUTER_NETWORK || 'regtest') as any,
    url: process.env.NEXT_PUBLIC_BITCOIN_COMPUTER_URL || 'https://rltc.node.bitcoincomputer.io'
  }) as any
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
  }
}

// Export Computer class for direct use
export { Computer }