import { Injectable, BadRequestException } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { Computer } from '@bitcoin-computer/lib'

/**
 * WalletService
 *
 * Handles wallet operations:
 * - Get wallet balance
 * - Fund wallet (development only)
 */
@Injectable()
export class WalletService {
  private prisma: PrismaClient

  constructor() {
    this.prisma = new PrismaClient()
  }

  /**
   * Get user's wallet balance
   */
  async getBalance(userId: string) {
    // Get user's wallet info
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        encryptedMnemonic: true,
        address: true,
      },
    })

    if (!user || !user.encryptedMnemonic) {
      throw new BadRequestException('Wallet not configured')
    }

    try {
      // Initialize user's computer
      const computer = new Computer({
        chain: process.env.BC_CHAIN || 'LTC',
        network: process.env.BC_NETWORK || 'regtest',
        mnemonic: user.encryptedMnemonic, // TODO: Decrypt
      })

      const { balance } = await computer.getBalance()

      return {
        address: user.address,
        balance: Number(balance),
        balanceSats: Number(balance),
        balanceBTC: Number(balance) / 1e8,
      }
    } catch (error) {
      console.error('Error getting balance:', error)
      throw new BadRequestException(`Failed to get balance: ${error.message}`)
    }
  }

  /**
   * Fund wallet from faucet (development only)
   */
  async fundWallet(userId: string, amount?: number) {
    // Only allow in development/regtest
    if (process.env.BC_NETWORK !== 'regtest' && process.env.NODE_ENV !== 'development') {
      throw new BadRequestException('Faucet only available in development')
    }

    // Get user's wallet info
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        encryptedMnemonic: true,
        address: true,
      },
    })

    if (!user || !user.encryptedMnemonic) {
      throw new BadRequestException('Wallet not configured')
    }

    try {
      // Initialize user's computer
      const computer = new Computer({
        chain: process.env.BC_CHAIN || 'LTC',
        network: process.env.BC_NETWORK || 'regtest',
        mnemonic: user.encryptedMnemonic, // TODO: Decrypt
      })

      // Default amount: 1M sats
      const fundAmount = amount || 1000000

      console.log(`💰 Funding wallet ${user.address} with ${fundAmount} sats...`)

      await computer.faucet(fundAmount)

      // Wait for transaction to settle
      await new Promise(resolve => setTimeout(resolve, 1000))

      const { balance } = await computer.getBalance()

      console.log(`✅ Wallet funded! New balance: ${balance} sats`)

      return {
        message: 'Wallet funded successfully',
        address: user.address,
        fundedAmount: fundAmount,
        newBalance: Number(balance),
      }
    } catch (error) {
      console.error('Error funding wallet:', error)
      throw new BadRequestException(`Failed to fund wallet: ${error.message}`)
    }
  }
}
