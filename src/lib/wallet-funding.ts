/**
 * Wallet Funding Helper
 * 
 * Ensures teacher wallets have spendable UTXOs for contract deployment
 */

import { getUserWallet } from './wallet-service'
import { prisma } from './prisma'

/**
 * Ensure user has spendable UTXOs for transactions
 * 
 * @param userId - User ID to check and fund
 * @param minAmount - Minimum amount needed in satoshis (default: 100000 = 0.001 LTC)
 * @param skipCheck - Skip UTXO check (for regtest when all funds locked in contracts)
 * @returns true if wallet has UTXOs, throws if unable to fund
 */
export async function ensureWalletHasUTXOs(
  userId: string, 
  minAmount: number = 100000,
  skipCheck: boolean = false
): Promise<boolean> {
  console.log(`\n🔍 Checking wallet UTXOs for user ${userId}...`)

  const computer = await getUserWallet(userId)
  const { balance, utxos } = await computer.getBalance()

  console.log(`   Current balance: ${balance} sats`)
  console.log(`   Available UTXOs: ${utxos?.length || 0}`)

  // If has UTXOs, we're good
  if (utxos && utxos.length > 0) {
    console.log(`   ✅ Wallet has ${utxos.length} spendable UTXOs`)
    return true
  }

  // No UTXOs - check if we should skip
  if (skipCheck) {
    console.log(`   ⚠️  No UTXOs but skipCheck=true, proceeding anyway...`)
    console.log(`   📝 Note: Contract deployment will use contract-locked funds`)
    return true
  }

  // No UTXOs and can't skip - need to fund
  console.log(`   ⚠️  No spendable UTXOs found`)

  // Only fund on regtest
  if (process.env.NEXT_PUBLIC_BITCOIN_COMPUTER_NETWORK !== 'regtest') {
    throw new Error('Wallet has no spendable UTXOs. Please fund your wallet before creating quizzes.')
  }

  // On regtest, we know faucet won't help (creates contract-locked funds)
  // So we provide a helpful error message
  console.log(`   ℹ️  Regtest detected: All funds are locked in contracts`)
  console.log(`   💡 Solution: Use external Bitcoin wallet to send fresh UTXOs`)
  console.log(`   📍 Wallet address: ${computer.getAddress()}`)
  
  throw new Error(
    `Wallet has ${balance} sats but all are locked in contracts. ` +
    `To create new contracts, send fresh coins from an external wallet to: ${computer.getAddress()}`
  )
}

/**
 * Check if wallet needs funding before operation
 * Returns true if ready, false if needs funding
 */
export async function checkWalletReady(userId: string): Promise<{ ready: boolean; balance: bigint; utxos: number }> {
  const computer = await getUserWallet(userId)
  const { balance, utxos } = await computer.getBalance()

  return {
    ready: utxos !== undefined && utxos.length > 0,
    balance,
    utxos: utxos?.length || 0
  }
}
