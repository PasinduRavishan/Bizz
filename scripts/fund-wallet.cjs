/**
 * Fund Wallet Script
 * 
 * Funds a user's wallet with spendable UTXOs so they can send payments.
 * This is necessary because contract operations lock satoshis, leaving no
 * spendable UTXOs for regular transactions.
 * 
 * Usage: node scripts/fund-wallet.cjs <userId> <amount>
 */

// Load environment variables
require('dotenv').config({ path: '.env.local' })

const { PrismaClient } = require('@prisma/client')
const { Computer } = require('@bitcoin-computer/lib')
const CryptoJS = require('crypto-js')

const prisma = new PrismaClient()

function decryptMnemonic(encryptedMnemonic, encryptionKey) {
  if (!encryptionKey || encryptionKey.length < 32) {
    throw new Error('Encryption key must be at least 32 characters')
  }

  try {
    const decrypted = CryptoJS.AES.decrypt(encryptedMnemonic, encryptionKey)
    const mnemonic = decrypted.toString(CryptoJS.enc.Utf8)

    if (!mnemonic) {
      throw new Error('Decryption failed - invalid encryption key or corrupted data')
    }

    return mnemonic
  } catch (error) {
    throw new Error(`Failed to decrypt mnemonic: ${error.message}`)
  }
}

async function getUserWallet(userId) {
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

  const computer = new Computer({
    chain: process.env.NEXT_PUBLIC_BITCOIN_COMPUTER_CHAIN || 'LTC',
    network: process.env.NEXT_PUBLIC_BITCOIN_COMPUTER_NETWORK || 'regtest',
    url: process.env.NEXT_PUBLIC_BITCOIN_COMPUTER_URL || 'https://rltc.node.bitcoincomputer.io',
    mnemonic: mnemonic
  })

  return computer
}

async function fundWallet(userId, amount) {
  console.log(`\n💰 FUNDING WALLET`)
  console.log('='.repeat(60))
  console.log(`User ID: ${userId}`)
  console.log(`Amount: ${amount} sats\n`)

  try {
    // Get user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        address: true,
        walletBalance: true
      }
    })

    if (!user) {
      console.error('❌ User not found!')
      process.exit(1)
    }

    console.log(`User: ${user.name} (${user.email})`)
    console.log(`Address: ${user.address}`)
    console.log(`Current balance: ${user.walletBalance} sats\n`)

    // Get user's wallet
    const computer = await getUserWallet(userId)
    
    // Check current balance and UTXOs
    const { balance, utxos } = await computer.getBalance()
    console.log(`Actual blockchain balance: ${balance} sats`)
    console.log(`Available UTXOs: ${utxos?.length || 0}`)
    
    if (utxos && utxos.length > 0) {
      console.log(`\nUTXO Details:`)
      utxos.forEach((utxo, index) => {
        console.log(`  ${index + 1}. ${utxo.satoshis} sats - ${utxo.txId.slice(0, 16)}...`)
      })
    }

    // Fund wallet on regtest
    if (process.env.NEXT_PUBLIC_BITCOIN_COMPUTER_NETWORK === 'regtest') {
      console.log(`\n🚰 Using faucet (regtest)...`)
      await computer.faucet(amount) // Amount in satoshis
      console.log(`✅ Faucet request sent for ${amount} sats`)
    } else {
      console.error(`❌ Only regtest funding is supported in this script`)
      console.error(`   For mainnet/testnet, manually send funds to: ${user.address}`)
      process.exit(1)
    }

    // Wait a bit for the transaction to be mined
    console.log(`\n⏳ Waiting for transaction to be mined...`)
    await new Promise(resolve => setTimeout(resolve, 3000))

    // Check new balance
    const { balance: newBalance, utxos: newUtxos } = await computer.getBalance()
    console.log(`\n✅ New balance: ${newBalance} sats`)
    console.log(`✅ Available UTXOs: ${newUtxos?.length || 0}`)
    
    if (newUtxos && newUtxos.length > 0) {
      console.log(`\nNew UTXO Details:`)
      newUtxos.forEach((utxo, index) => {
        console.log(`  ${index + 1}. ${utxo.satoshis} sats - ${utxo.txId.slice(0, 16)}...`)
      })
    }

    // Update database
    await prisma.user.update({
      where: { id: userId },
      data: {
        walletBalance: newBalance,
        lastBalanceCheck: new Date()
      }
    })
    console.log(`\n💾 Database updated`)

    console.log(`\n✅ Wallet funded successfully!`)
    console.log('='.repeat(60))

  } catch (error) {
    console.error('\n❌ Error:', error.message)
    if (error.stack) {
      console.error(error.stack)
    }
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run
const userId = process.argv[2]
const amount = parseInt(process.argv[3])

if (!userId || !amount) {
  console.error('Usage: node scripts/fund-wallet.js <userId> <amount-in-sats>')
  console.error('Example: node scripts/fund-wallet.js cmka5glj200035rqbj4m8o177 100000')
  process.exit(1)
}

fundWallet(userId, amount)
