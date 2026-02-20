import CryptoJS from 'crypto-js'

/**
 * Crypto utilities for Quiz Platform
 *
 * Uses SHA256 hashing for:
 * - Answer hashing (teacher stores hashed answers)
 * - Commitment hashing (student commits to answers before revealing)
 */

/**
 * Hash a single answer for a quiz
 * Format: SHA256(quizId + index + answer + salt)
 *
 * @param quizId - Unique quiz identifier
 * @param index - Answer index (0-based)
 * @param answer - The correct answer
 * @param salt - Random salt for security
 * @returns Hex-encoded SHA256 hash
 */
export function hashAnswer(quizId: string, index: number, answer: string, salt: string): string {
  const data = `${quizId}${index}${answer}${salt}`
  return CryptoJS.SHA256(data).toString()
}

/**
 * Hash all answers for a quiz
 *
 * @param quizId - Unique quiz identifier
 * @param answers - Array of correct answers
 * @param salt - Random salt for security
 * @returns Array of hex-encoded SHA256 hashes
 */
export function hashAnswers(quizId: string, answers: string[], salt: string): string[] {
  return answers.map((answer, index) => hashAnswer(quizId, index, answer, salt))
}

/**
 * Create a commitment hash for student answers
 * Format: SHA256(JSON.stringify(answers) + nonce)
 *
 * This is used in the commit-reveal scheme:
 * 1. Student submits commitment (hash of answers + nonce)
 * 2. After deadline, student reveals actual answers + nonce
 * 3. System verifies hash matches
 *
 * @param answers - Array of student's answers
 * @param nonce - Random nonce for commitment
 * @returns Hex-encoded SHA256 hash
 */
export function hashCommitment(answers: string[], nonce: string): string {
  const data = JSON.stringify(answers) + nonce
  return CryptoJS.SHA256(data).toString()
}

/**
 * Verify a commitment matches revealed answers
 *
 * @param answers - Revealed answers
 * @param nonce - Revealed nonce
 * @param commitment - Original commitment hash
 * @returns True if commitment matches
 */
export function verifyCommitment(answers: string[], nonce: string, commitment: string): boolean {
  const computed = hashCommitment(answers, nonce)
  return computed === commitment
}

/**
 * Generate a random salt for answer hashing
 * Uses crypto-secure random bytes
 *
 * @returns 64-character hex string (32 bytes)
 */
export function generateSalt(): string {
  // Generate 32 random bytes (256 bits)
  const randomWords = CryptoJS.lib.WordArray.random(32)
  return randomWords.toString()
}

/**
 * Generate a random nonce for commitments
 * Uses crypto-secure random bytes
 *
 * @returns 64-character hex string (32 bytes)
 */
export function generateNonce(): string {
  return generateSalt() // Same implementation
}

/**
 * Verify an answer hash matches
 *
 * @param quizId - Quiz identifier
 * @param index - Answer index
 * @param answer - Answer to verify
 * @param salt - Salt used in original hash
 * @param expectedHash - Expected hash value
 * @returns True if answer is correct
 */
export function verifyAnswerHash(
  quizId: string,
  index: number,
  answer: string,
  salt: string,
  expectedHash: string
): boolean {
  const computed = hashAnswer(quizId, index, answer, salt)
  return computed === expectedHash
}

/**
 * Wallet Encryption/Decryption for Custodial Wallets
 * 
 * Uses AES-256 encryption to securely store user mnemonics
 */

/**
 * Encrypt a mnemonic phrase for storage
 * 
 * @param mnemonic - BIP39 mnemonic phrase
 * @param encryptionKey - Encryption key from environment
 * @returns Encrypted string
 */
export function encryptMnemonic(mnemonic: string, encryptionKey: string): string {
  if (!encryptionKey || encryptionKey.length < 32) {
    throw new Error('Encryption key must be at least 32 characters')
  }
  
  const encrypted = CryptoJS.AES.encrypt(mnemonic, encryptionKey)
  return encrypted.toString()
}

/**
 * Decrypt a mnemonic phrase from storage
 * 
 * @param encryptedMnemonic - Encrypted mnemonic string
 * @param encryptionKey - Encryption key from environment
 * @returns Decrypted mnemonic phrase
 */
export function decryptMnemonic(encryptedMnemonic: string, encryptionKey: string): string {
  if (!encryptionKey || encryptionKey.length < 32) {
    throw new Error('Encryption key must be at least 32 characters')
  }

  try {
    const decrypted = CryptoJS.AES.decrypt(encryptedMnemonic, encryptionKey)
    const mnemonic = decrypted.toString(CryptoJS.enc.Utf8)

    if (!mnemonic) {
      throw new Error('Decryption failed - invalid key or corrupted data')
    }

    return mnemonic
  } catch (error) {
    throw new Error('Failed to decrypt mnemonic: ' + (error instanceof Error ? error.message : 'Unknown error'))
  }
}

/**
 * Reveal Data Encryption/Decryption for Production Storage
 *
 * Uses AES-256 encryption to securely store reveal data server-side.
 * This eliminates the need for localStorage and provides cross-device support.
 */

export interface QuizRevealData {
  answers: string[]
  salt: string
}

export interface AttemptRevealData {
  answers: string[]
  nonce: string
}

/**
 * Encrypt quiz reveal data (teacher's correct answers + salt)
 *
 * @param data - Quiz reveal data containing answers and salt
 * @param encryptionKey - Encryption key from environment (REVEAL_DATA_KEY)
 * @returns Encrypted string
 */
export function encryptQuizRevealData(data: QuizRevealData, encryptionKey: string): string {
  if (!encryptionKey || encryptionKey.length < 32) {
    throw new Error('Encryption key must be at least 32 characters')
  }

  const jsonData = JSON.stringify(data)
  const encrypted = CryptoJS.AES.encrypt(jsonData, encryptionKey)
  return encrypted.toString()
}

/**
 * Decrypt quiz reveal data
 *
 * @param encryptedData - Encrypted reveal data string
 * @param encryptionKey - Encryption key from environment
 * @returns Decrypted quiz reveal data
 */
export function decryptQuizRevealData(encryptedData: string, encryptionKey: string): QuizRevealData {
  if (!encryptionKey || encryptionKey.length < 32) {
    throw new Error('Encryption key must be at least 32 characters')
  }

  try {
    const decrypted = CryptoJS.AES.decrypt(encryptedData, encryptionKey)
    const jsonString = decrypted.toString(CryptoJS.enc.Utf8)

    if (!jsonString) {
      throw new Error('Decryption failed - invalid key or corrupted data')
    }

    return JSON.parse(jsonString) as QuizRevealData
  } catch (error) {
    throw new Error('Failed to decrypt quiz reveal data: ' + (error instanceof Error ? error.message : 'Unknown error'))
  }
}

/**
 * Encrypt attempt reveal data (student's answers + nonce)
 *
 * @param data - Attempt reveal data containing answers and nonce
 * @param encryptionKey - Encryption key from environment (REVEAL_DATA_KEY)
 * @returns Encrypted string
 */
export function encryptAttemptRevealData(data: AttemptRevealData, encryptionKey: string): string {
  if (!encryptionKey || encryptionKey.length < 32) {
    throw new Error('Encryption key must be at least 32 characters')
  }

  const jsonData = JSON.stringify(data)
  const encrypted = CryptoJS.AES.encrypt(jsonData, encryptionKey)
  return encrypted.toString()
}

/**
 * Decrypt attempt reveal data
 *
 * @param encryptedData - Encrypted reveal data string
 * @param encryptionKey - Encryption key from environment
 * @returns Decrypted attempt reveal data
 */
export function decryptAttemptRevealData(encryptedData: string, encryptionKey: string): AttemptRevealData {
  if (!encryptionKey || encryptionKey.length < 32) {
    throw new Error('Encryption key must be at least 32 characters')
  }

  try {
    const decrypted = CryptoJS.AES.decrypt(encryptedData, encryptionKey)
    const jsonString = decrypted.toString(CryptoJS.enc.Utf8)

    if (!jsonString) {
      throw new Error('Decryption failed - invalid key or corrupted data')
    }

    return JSON.parse(jsonString) as AttemptRevealData
  } catch (error) {
    throw new Error('Failed to decrypt attempt reveal data: ' + (error instanceof Error ? error.message : 'Unknown error'))
  }
}
