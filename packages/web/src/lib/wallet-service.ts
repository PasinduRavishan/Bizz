/**
 * Wallet Service
 * 
 * Handles custodial wallet operations including:
 * - Mnemonic generation
 * - Wallet balance checking
 * - Wallet funding
 */

import { encryptMnemonic, decryptMnemonic } from './crypto'
import { prisma } from './prisma'

/**
 * Generate a BIP39 mnemonic phrase (12 words)
 * Uses the bip39 library from Bitcoin Computer
 * 
 * @returns 12-word mnemonic phrase
 */
export async function generateMnemonic(): Promise<string> {

  const { generateMnemonic } = await import('bip39')
  return generateMnemonic()
}

/**
 * Get Bitcoin Computer instance for a user's wallet
 * 
 * @param userId - User ID to get wallet for
 * @returns Computer instance configured with user's wallet
 */
export async function getUserWallet(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId }
  })

  if (!user) {
    throw new Error('User not found')
  }

  if (!user.encryptedMnemonic) {
    throw new Error('User has no custodial wallet')
  }

  const encryptionKey = process.env.WALLET_ENCRYPTION_KEY
  if (!encryptionKey) {
    throw new Error('WALLET_ENCRYPTION_KEY not configured')
  }

  const mnemonic = decryptMnemonic(user.encryptedMnemonic, encryptionKey)

  // @ts-expect-error - Dynamic import
  const { Computer } = await import('@bitcoin-computer/lib')

  const computer = new Computer({
    chain: (process.env.NEXT_PUBLIC_BITCOIN_COMPUTER_CHAIN || 'LTC') as 'LTC',
    network: (process.env.NEXT_PUBLIC_BITCOIN_COMPUTER_NETWORK || 'regtest') as 'regtest',
    url: process.env.NEXT_PUBLIC_BITCOIN_COMPUTER_URL || 'https://rltc.node.bitcoincomputer.io',
    mnemonic: mnemonic
  })

  return computer
}

/**
 * Get user's wallet balance and update in database
 * 
 * @param userId - User ID to check balance for
 * @returns Balance in satoshis
 */
export async function getUserBalance(userId: string): Promise<bigint> {
  const computer = await getUserWallet(userId)
  const { balance } = await computer.getBalance()

  // Update cached balance in database
  await prisma.user.update({
    where: { id: userId },
    data: {
      walletBalance: balance,
      lastBalanceCheck: new Date()
    }
  })

  return balance
}

/**
 * Fund a user's wallet from the server funding wallet
 * Used to give new users starter funds for gas fees
 * 
 * @param userId - User ID to fund
 * @param amount - Amount in satoshis (unused in regtest, faucet gives fixed amount)
 * @returns Transaction ID or 'faucet' for regtest
 */
export async function fundUserWallet(userId: string, amount: number): Promise<string> {
  // Get user's wallet
  const userComputer = await getUserWallet(userId)
  const userAddress = userComputer.getAddress()

  // On regtest, use faucet directly on user's wallet (easier than managing UTXOs)
  if (process.env.NEXT_PUBLIC_BITCOIN_COMPUTER_NETWORK === 'regtest') {
    console.log(`💰 Funding user ${userId} with faucet to ${userAddress}`)
    await userComputer.faucet(0.1e8) // Request 0.1 LTC (10M sats) from faucet
    console.log(`✅ Faucet funded user wallet`)
    
    // Update user balance
    await getUserBalance(userId)
    
    return 'faucet'
  }

  // For mainnet/testnet, transfer from funding wallet
  const fundingMnemonic = process.env.FUNDING_WALLET_MNEMONIC || process.env.BITCOIN_COMPUTER_MNEMONIC
  
  if (!fundingMnemonic) {
    throw new Error('No funding wallet configured')
  }

  // @ts-expect-error - Dynamic import
  const { Computer } = await import('@bitcoin-computer/lib')

  // Create funding wallet instance
  const fundingComputer = new Computer({
    chain: (process.env.NEXT_PUBLIC_BITCOIN_COMPUTER_CHAIN || 'LTC') as 'LTC',
    network: process.env.NEXT_PUBLIC_BITCOIN_COMPUTER_NETWORK as 'testnet' | 'livenet',
    url: process.env.NEXT_PUBLIC_BITCOIN_COMPUTER_URL || 'https://rltc.node.bitcoincomputer.io',
    mnemonic: fundingMnemonic
  })

  // Check funding wallet balance
  const { balance } = await fundingComputer.getBalance()
  console.log(`💰 Funding wallet balance: ${balance} sats`)
  
  if (balance < BigInt(amount + 100000)) {
    throw new Error(`Funding wallet has insufficient balance. Need ${amount + 100000} sats, have ${balance} sats`)
  }

  // Send funds to user (convert satoshis to BTC)
  console.log(`💰 Sending ${amount} sats to ${userAddress}`)
  const amountInBTC = amount / 1e8 // Convert satoshis to BTC
  const txId = await fundingComputer.send(userAddress, amountInBTC)

  // Update user balance
  await getUserBalance(userId)

  console.log(`✅ User ${userId} funded with ${amount} sats (txId: ${txId})`)

  return txId
}

/**
 * Initialize wallet for a new user
 * Generates mnemonic, encrypts it, and funds with starter amount
 * 
 * @param userId - User ID to initialize wallet for
 * @returns User's wallet address
 */
export async function initializeUserWallet(userId: string): Promise<{ address: string; publicKey: string }> {
  const encryptionKey = process.env.WALLET_ENCRYPTION_KEY
  if (!encryptionKey) {
    throw new Error('WALLET_ENCRYPTION_KEY not configured')
  }

  // Generate new mnemonic
  const mnemonic = await generateMnemonic()
  console.log(`🔑 Generated wallet for user ${userId}`)

  // Encrypt mnemonic
  const encryptedMnemonic = encryptMnemonic(mnemonic, encryptionKey)

  // @ts-expect-error - Dynamic import
  const { Computer } = await import('@bitcoin-computer/lib')

  // Create temporary computer instance to get address
  const tempComputer = new Computer({
    chain: (process.env.NEXT_PUBLIC_BITCOIN_COMPUTER_CHAIN || 'LTC') as 'LTC',
    network: (process.env.NEXT_PUBLIC_BITCOIN_COMPUTER_NETWORK || 'regtest') as 'regtest',
    url: process.env.NEXT_PUBLIC_BITCOIN_COMPUTER_URL || 'https://rltc.node.bitcoincomputer.io',
    mnemonic: mnemonic
  })

  const address = tempComputer.getAddress()
  const publicKey = tempComputer.getPublicKey()

  // Update user with wallet info
  await prisma.user.update({
    where: { id: userId },
    data: {
      encryptedMnemonic,
      address,
      publicKey,
      walletType: 'CUSTODIAL',
      walletBalance: BigInt(0)
    }
  })

  console.log(`✅ Wallet initialized for user ${userId}: ${address}`)

  // Fund wallet with starter amount (500k sats for gas + testing)
  try {
    await fundUserWallet(userId, 500000)
    console.log(`💰 Funded user ${userId} with 500k sats starter amount`)
  } catch (error) {
    console.error('⚠️ Failed to fund user wallet:', error)
    // Don't fail - user can still be created, just won't have initial funds
  }

  return { address, publicKey }
}
