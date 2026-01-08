// @ts-ignore
import { Computer } from '@bitcoin-computer/lib'
// import QuizAttempt from '../../contracts/QuizAttempt'

/**
 * Query all attempts for a specific quiz
 * 
 * @param computer - Bitcoin Computer instance
 * @param quizRev - Quiz revision to query attempts for
 * @returns Array of QuizAttempt contracts
 */
export async function getQuizAttempts(
  computer: typeof Computer.prototype,
  quizRev: string
): Promise<any[]> {
  // Bitcoin Computer doesn't have built-in query yet
  // For now, we track attempts off-chain in our database
  // Or we can sync all QuizAttempt contracts and filter
  
  // This will be implemented when we add the indexer
  // For now, return empty array
  console.log('📊 Querying attempts for quiz:', quizRev)
  return []
}

/**
 * Get attempt count for a quiz (off-chain)
 * In production, this queries your database/indexer
 */
export async function getAttemptCount(quizRev: string): Promise<number> {
  // Query from database
  // For now, return 0
  return 0
}

/**
 * Verify hash matches commitment
 * This happens off-chain in the app
 */
export function verifyCommitment(
  answers: string[],
  nonce: string,
  commitment: string
): boolean {
  const crypto = require('crypto')
  const data = JSON.stringify(answers) + nonce
  const hash = crypto.createHash('sha256').update(data).digest('hex')
  return hash === commitment
}

/**
 * Verify answer hash matches
 * This happens off-chain in the app
 */
export function verifyAnswerHash(
  quizId: string,
  index: number,
  answer: string,
  salt: string,
  expectedHash: string
): boolean {
  const crypto = require('crypto')
  const data = `${quizId}${index}${answer}${salt}`
  const hash = crypto.createHash('sha256').update(data).digest('hex')
  return hash === expectedHash
}