
import { Computer } from '@bitcoin-computer/lib'
import * as crypto from 'crypto'

export interface BalanceInfo {
  balance: bigint
  confirmed: bigint
  unconfirmed: bigint
}


export class TestHelper {

  static async waitForMempool(ms: number = 200): Promise<void> {
    await this.sleep(ms)
  }


  static async mineBlocks(computer: Computer, count: number = 1): Promise<void> {
    try {
      const newAddress = await computer.rpcCall('getnewaddress', 'mywallet legacy')
      console.log(`        Mining ${count} block(s)...`)
      await computer.rpcCall('generatetoaddress', `${count} ${newAddress.result}`)
      await this.sleep(500) // Brief wait for block propagation
    } catch (error) {
      console.log('      ❌ Error mining blocks:', (error as Error).message)
    }
  }


  static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }


  static async getBalance(computer: Computer): Promise<BalanceInfo> {
    const balanceData = await computer.getBalance()
    return {
      balance: balanceData.balance,
      confirmed: balanceData.confirmed || BigInt(0),
      unconfirmed: balanceData.unconfirmed || BigInt(0)
    }
  }


  static displayBalanceChange(label: string, before: bigint, after: bigint): void {
    const diff = after - before
    const sign = diff >= BigInt(0) ? '+' : ''
    console.log(`      ${label}:`)
    console.log(`        Before: ${before.toLocaleString()} sats`)
    console.log(`        After:  ${after.toLocaleString()} sats`)
    console.log(`        Change: ${sign}${diff.toLocaleString()} sats`)
  }

}


export class QuizCrypto {
  /**
   * Hash answer with salt for quiz verification
   */
  static hashAnswer(quizId: string, index: number, answer: string, salt: string): string {
    const data = `${quizId}${index}${answer}${salt}`
    return crypto.createHash('sha256').update(data).digest('hex')
  }

  /**
   * Hash commitment for answer submission
   */
  static hashCommitment(answers: string[], nonce: string): string {
    const data = JSON.stringify(answers) + nonce
    return crypto.createHash('sha256').update(data).digest('hex')
  }

  /**
   * Generate cryptographic salt
   */
  static generateSalt(): string {
    return crypto.randomBytes(32).toString('hex')
  }
}

/**
 * Quiz scoring utilities
 */
export class QuizScoring {
  /**
   * Calculate quiz score from student answers
   */
  static calculateScore(
    studentAnswers: string[],
    correctAnswers: string[]
  ): { correct: number; total: number; percentage: number } {
    let correct = 0
    for (let i = 0; i < correctAnswers.length; i++) {
      if (studentAnswers[i] === correctAnswers[i]) {
        correct++
      }
    }
    const percentage = Math.floor((correct / correctAnswers.length) * 100)
    return { correct, total: correctAnswers.length, percentage }
  }

  /**
   * Check if student passed quiz
   */
  static didPass(score: number, threshold: number): boolean {
    return score >= threshold
  }
}
