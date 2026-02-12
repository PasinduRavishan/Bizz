/**
 * Quiz Cryptography Utilities
 * Matches the test helper functions exactly
 */

import crypto from 'crypto'

export class QuizCrypto {
  /**
   * Generate a random salt for answer hashing
   */
  static generateSalt(): string {
    return crypto.randomBytes(32).toString('hex')
  }

  /**
   * Hash an answer with quiz context
   * Format: SHA256(quizId + questionIndex + answer + salt)
   */
  static hashAnswer(quizId: string, questionIndex: number, answer: string, salt: string): string {
    const data = `${quizId}${questionIndex}${answer}${salt}`
    return crypto.createHash('sha256').update(data).digest('hex')
  }

  /**
   * Hash a commitment from answers array
   * Format: SHA256(JSON.stringify(answers) + nonce)
   */
  static hashCommitment(answers: string[], nonce: string): string {
    const data = JSON.stringify(answers) + nonce
    return crypto.createHash('sha256').update(data).digest('hex')
  }

  /**
   * Verify answer hash
   */
  static verifyAnswerHash(
    quizId: string,
    questionIndex: number,
    answer: string,
    salt: string,
    expectedHash: string
  ): boolean {
    const actualHash = this.hashAnswer(quizId, questionIndex, answer, salt)
    return actualHash === expectedHash
  }

  /**
   * Verify commitment
   */
  static verifyCommitment(answers: string[], nonce: string, expectedCommitment: string): boolean {
    const actualCommitment = this.hashCommitment(answers, nonce)
    return actualCommitment === expectedCommitment
  }
}
