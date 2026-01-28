/**
 * Fix Legacy Quiz Hashes
 * 
 * This script fixes quizzes that were created with the tempQuizId bug.
 * It decrypts the reveal data, re-hashes with the contractId, and updates the database.
 */

import { PrismaClient } from '@prisma/client'
import CryptoJS from 'crypto-js'

const prisma = new PrismaClient()

// Decrypt reveal data
function decryptQuizRevealData(encryptedData, encryptionKey) {
  const decrypted = CryptoJS.AES.decrypt(encryptedData, encryptionKey)
  const jsonString = decrypted.toString(CryptoJS.enc.Utf8)
  return JSON.parse(jsonString)
}

// Hash a single answer
function hashAnswer(quizId, index, answer, salt) {
  const data = `${quizId}-${index}-${answer}-${salt}`
  return CryptoJS.SHA256(data).toString()
}

// Hash all answers
function hashAnswers(quizId, answers, salt) {
  return answers.map((answer, index) => hashAnswer(quizId, index, answer, salt))
}

async function fixLegacyQuiz(quizId) {
  const REVEAL_DATA_KEY = process.env.REVEAL_DATA_KEY || process.env.WALLET_ENCRYPTION_KEY
  
  if (!REVEAL_DATA_KEY) {
    throw new Error('REVEAL_DATA_KEY environment variable is required')
  }

  // Get the quiz
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    select: {
      id: true,
      contractId: true,
      hashingQuizId: true,
      answerHashes: true,
      encryptedRevealData: true
    }
  })

  if (!quiz) {
    throw new Error(`Quiz ${quizId} not found`)
  }

  if (!quiz.encryptedRevealData) {
    throw new Error('Quiz has no encrypted reveal data')
  }

  console.log('📝 Fixing quiz:', quiz.id)
  console.log('  Contract ID:', quiz.contractId)
  console.log('  Current hashing ID:', quiz.hashingQuizId)

  // Decrypt reveal data
  const { answers, salt } = decryptQuizRevealData(quiz.encryptedRevealData, REVEAL_DATA_KEY)
  console.log('🔐 Decrypted answers:', answers)
  console.log('🔐 Salt:', salt.substring(0, 20) + '...')

  // Re-hash with contractId
  const newHashes = hashAnswers(quiz.contractId, answers, salt)
  console.log('🔄 New hashes:', newHashes)

  // Update database
  await prisma.quiz.update({
    where: { id: quiz.id },
    data: {
      answerHashes: newHashes,
      hashingQuizId: quiz.contractId
    }
  })

  console.log('✅ Quiz fixed! Answer hashes updated to use contractId')
}

async function main() {
  const quizId = process.argv[2]
  
  if (!quizId) {
    console.error('Usage: node fix-legacy-quiz-hashes.js <quizId>')
    process.exit(1)
  }

  try {
    await fixLegacyQuiz(quizId)
  } catch (error) {
    console.error('❌ Error:', error.message)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

main()
