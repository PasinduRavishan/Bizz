/**
 * IPFS utilities for Quiz Platform
 *
 * For now, we use a simple placeholder that stores questions
 * as a JSON string hash. In production, this would upload to IPFS.
 */

import CryptoJS from 'crypto-js'

export interface QuizQuestion {
  question: string
  options: string[]
  // Note: correctAnswer is NOT stored in IPFS (only hashes on blockchain)
}

/**
 * Upload questions to IPFS (placeholder implementation)
 *
 * In production, this would:
 * 1. Upload JSON to IPFS via Infura/Pinata
 * 2. Return the IPFS CID (Content Identifier)
 *
 * For now, we create a deterministic hash of the questions
 * that can be used as a placeholder identifier.
 *
 * @param questions - Array of questions (without correct answers)
 * @returns Promise resolving to IPFS-like hash
 */
export async function uploadQuestionsToIPFS(questions: QuizQuestion[]): Promise<string> {
  // Create a deterministic hash of the questions
  const questionsJson = JSON.stringify(questions)
  const hash = CryptoJS.SHA256(questionsJson).toString()

  // Return a placeholder IPFS-style CID
  // Format: Qm + first 44 chars of hash (mimics IPFS CID v0)
  return `Qm${hash.substring(0, 44)}`
}

/**
 * Fetch questions from IPFS (placeholder implementation)
 *
 * In production, this would fetch from IPFS gateway.
 * For now, questions would need to be stored elsewhere.
 *
 * @param ipfsHash - IPFS CID
 * @returns Promise resolving to questions array
 */
export async function fetchQuestionsFromIPFS(ipfsHash: string): Promise<QuizQuestion[] | null> {
  // Placeholder - in production, fetch from IPFS gateway
  console.log('Fetching from IPFS:', ipfsHash)

  // For now, return null (questions not available)
  // In production: fetch from https://ipfs.io/ipfs/{ipfsHash}
  return null
}

/**
 * Store questions locally (temporary solution)
 *
 * Since IPFS integration is not complete, we store questions
 * in localStorage for demo purposes.
 *
 * @param quizId - Quiz identifier
 * @param questions - Array of questions with correct answers
 */
export function storeQuestionsLocally(
  quizId: string,
  questions: Array<{ question: string; options: string[]; correctAnswer: number }>
): void {
  if (typeof window !== 'undefined') {
    const key = `quiz_questions_${quizId}`
    localStorage.setItem(key, JSON.stringify(questions))
  }
}

/**
 * Retrieve questions from local storage
 *
 * @param quizId - Quiz identifier
 * @returns Questions array or null
 */
export function getQuestionsLocally(
  quizId: string
): Array<{ question: string; options: string[]; correctAnswer: number }> | null {
  if (typeof window !== 'undefined') {
    const key = `quiz_questions_${quizId}`
    const stored = localStorage.getItem(key)
    if (stored) {
      return JSON.parse(stored)
    }
  }
  return null
}
