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
export declare function hashAnswer(quizId: string, index: number, answer: string, salt: string): string;
/**
 * Hash all answers for a quiz
 *
 * @param quizId - Unique quiz identifier
 * @param answers - Array of correct answers
 * @param salt - Random salt for security
 * @returns Array of hex-encoded SHA256 hashes
 */
export declare function hashAnswers(quizId: string, answers: string[], salt: string): string[];
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
export declare function hashCommitment(answers: string[], nonce: string): string;
/**
 * Verify a commitment matches revealed answers
 *
 * @param answers - Revealed answers
 * @param nonce - Revealed nonce
 * @param commitment - Original commitment hash
 * @returns True if commitment matches
 */
export declare function verifyCommitment(answers: string[], nonce: string, commitment: string): boolean;
/**
 * Generate a random salt for answer hashing
 * Uses crypto-secure random bytes
 *
 * @returns 64-character hex string (32 bytes)
 */
export declare function generateSalt(): string;
/**
 * Generate a random nonce for commitments
 * Uses crypto-secure random bytes
 *
 * @returns 64-character hex string (32 bytes)
 */
export declare function generateNonce(): string;
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
export declare function verifyAnswerHash(quizId: string, index: number, answer: string, salt: string, expectedHash: string): boolean;
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
export declare function encryptMnemonic(mnemonic: string, encryptionKey: string): string;
/**
 * Decrypt a mnemonic phrase from storage
 *
 * @param encryptedMnemonic - Encrypted mnemonic string
 * @param encryptionKey - Encryption key from environment
 * @returns Decrypted mnemonic phrase
 */
export declare function decryptMnemonic(encryptedMnemonic: string, encryptionKey: string): string;
/**
 * Reveal Data Encryption/Decryption for Production Storage
 *
 * Uses AES-256 encryption to securely store reveal data server-side.
 * This eliminates the need for localStorage and provides cross-device support.
 */
export interface QuizRevealData {
    answers: string[];
    salt: string;
}
export interface AttemptRevealData {
    answers: string[];
    nonce: string;
}
/**
 * Encrypt quiz reveal data (teacher's correct answers + salt)
 *
 * @param data - Quiz reveal data containing answers and salt
 * @param encryptionKey - Encryption key from environment (REVEAL_DATA_KEY)
 * @returns Encrypted string
 */
export declare function encryptQuizRevealData(data: QuizRevealData, encryptionKey: string): string;
/**
 * Decrypt quiz reveal data
 *
 * @param encryptedData - Encrypted reveal data string
 * @param encryptionKey - Encryption key from environment
 * @returns Decrypted quiz reveal data
 */
export declare function decryptQuizRevealData(encryptedData: string, encryptionKey: string): QuizRevealData;
/**
 * Encrypt attempt reveal data (student's answers + nonce)
 *
 * @param data - Attempt reveal data containing answers and nonce
 * @param encryptionKey - Encryption key from environment (REVEAL_DATA_KEY)
 * @returns Encrypted string
 */
export declare function encryptAttemptRevealData(data: AttemptRevealData, encryptionKey: string): string;
/**
 * Decrypt attempt reveal data
 *
 * @param encryptedData - Encrypted reveal data string
 * @param encryptionKey - Encryption key from environment
 * @returns Decrypted attempt reveal data
 */
export declare function decryptAttemptRevealData(encryptedData: string, encryptionKey: string): AttemptRevealData;
//# sourceMappingURL=crypto.d.ts.map