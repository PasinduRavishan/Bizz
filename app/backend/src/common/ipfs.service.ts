/**
 * IPFS utilities for Quiz Platform - Backend Implementation
 * Uses Pinata for reliable IPFS uploads and multiple gateways for fetching
 */

import * as crypto from 'crypto';

export interface QuizQuestion {
  question: string;
  options: string[];
  // Note: correctAnswer is NOT stored in IPFS (only hashes on blockchain)
}

/**
 * Hash an answer with quiz ID, index, and salt (matches QuizCrypto pattern)
 *
 * @param quizId - Quiz identifier (use 'quiz-temp-id' for creation)
 * @param index - Answer index (0-based)
 * @param answer - The answer text
 * @param salt - Salt for hashing
 * @returns SHA256 hash hex string
 */
export function hashAnswer(quizId: string, index: number, answer: string, salt: string): string {
  const data = `${quizId}${index}${answer}${salt}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Hash multiple answers with quiz ID and salt
 *
 * @param answers - Array of answer texts
 * @param salt - Salt for hashing
 * @param quizId - Quiz identifier (defaults to 'quiz-temp-id')
 * @returns Array of SHA256 hash hex strings
 */
export function hashAnswers(answers: string[], salt: string, quizId: string = 'quiz-temp-id'): string[] {
  return answers.map((answer, index) => hashAnswer(quizId, index, answer, salt));
}

/**
 * Generate a random salt for answer hashing
 *
 * @returns Random 32-byte hex string
 */
export function generateSalt(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Upload questions to IPFS via Pinata
 *
 * @param questions - Array of questions (without correct answers)
 * @returns Promise resolving to IPFS CID
 */
export async function uploadQuestionsToIPFS(questions: QuizQuestion[]): Promise<string> {
  const PINATA_JWT = process.env.PINATA_JWT;

  if (!PINATA_JWT) {
    console.warn('⚠️ PINATA_JWT not configured, using mock IPFS hash');
    // For development without Pinata, return a mock hash
    return `QmMock${Date.now().toString(36)}`;
  }

  try {
    console.log('📤 Uploading questions to IPFS via Pinata...');

    const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PINATA_JWT}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        pinataContent: questions,
        pinataMetadata: {
          name: `quiz-questions-${Date.now()}.json`
        },
        pinataOptions: {
          cidVersion: 1
        }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Pinata upload failed: ${error}`);
    }

    const data = await response.json();
    console.log('✅ Questions uploaded to IPFS:', data.IpfsHash);
    return data.IpfsHash;
  } catch (error) {
    console.error('❌ IPFS upload error:', error);
    throw error;
  }
}

/**
 * Fetch questions from IPFS
 *
 * @param ipfsHash - IPFS CID
 * @returns Promise resolving to questions array
 */
export async function fetchQuestionsFromIPFS(ipfsHash: string): Promise<QuizQuestion[] | null> {
  console.log('📥 Fetching from IPFS:', ipfsHash);

  // Handle mock hashes (for development)
  if (ipfsHash.startsWith('QmMock')) {
    console.log('⚠️ Mock IPFS hash detected, returning null');
    return null;
  }

  try {
    // Try multiple IPFS gateways
    const gateways = [
      `https://ipfs.io/ipfs/${ipfsHash}`,
      `https://cloudflare-ipfs.com/ipfs/${ipfsHash}`,
      `https://gateway.pinata.cloud/ipfs/${ipfsHash}`
    ];

    for (const gateway of gateways) {
      try {
        const response = await fetch(gateway, {
          method: 'GET',
          signal: AbortSignal.timeout(5000) // 5 second timeout
        });

        if (response.ok) {
          const questions = await response.json();
          console.log('✅ Fetched from IPFS gateway:', gateway);
          return questions;
        }
      } catch {
        console.log('⚠️ Failed gateway:', gateway);
        continue;
      }
    }

    console.log('⚠️ All IPFS gateways failed');
    return null;
  } catch (error) {
    console.error('❌ Error fetching from IPFS:', error);
    return null;
  }
}
