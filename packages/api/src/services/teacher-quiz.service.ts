/**
 * Teacher Quiz Service
 * Business logic for teacher quiz operations
 */

import { prisma } from '@bizz/database'
import { Computer } from '@bitcoin-computer/lib'
import { QuizHelper } from '@bizz/sdk'
import { QuizCrypto } from '../utils/quiz-crypto'
import { getQuizModule } from '../utils/module-registry'

export interface CreateQuizParams {
  teacherId: string
  symbol: string
  questionHashIPFS: string
  questions?: any[]
  correctAnswers: string[]
  prizePool: number
  entryFee: number
  passThreshold: number
  deadline?: number
  title?: string
  description?: string
}

export interface CreateQuizResult {
  success: boolean
  quizId?: string
  quizRev?: string
  txId?: string
  quiz?: any
  error?: string
}

export class TeacherQuizService {
  /**
   * Create a new quiz as a fungible token (TBC20)
   * Step 1: Teacher creates quiz
   */
  static async createQuiz(
    teacherComputer: Computer,
    params: CreateQuizParams
  ): Promise<CreateQuizResult> {
    try {
      const {
        teacherId,
        symbol,
        questionHashIPFS,
        correctAnswers,
        prizePool,
        entryFee,
        passThreshold,
        deadline,
        title,
        description
      } = params

      const teacherPubKey = teacherComputer.getPublicKey()

      // Generate salt for answer hashing
      const salt = QuizCrypto.generateSalt()

      // Hash answers
      const tempQuizId = 'temp-quiz-id'
      const answerHashes = correctAnswers.map((answer: string, index: number) =>
        QuizCrypto.hashAnswer(tempQuizId, index, answer, salt)
      )

      // Calculate deadlines
      const deadlineTimestamp = deadline || Date.now() + 7 * 24 * 60 * 60 * 1000
      const teacherRevealDeadline = deadlineTimestamp + 48 * 60 * 60 * 1000

      // Create Quiz using helper with pre-deployed module
      const quizMod = await getQuizModule(teacherComputer)
      const quizHelper = new QuizHelper(teacherComputer, quizMod)
      const { tx, effect } = await quizHelper.createQuiz({
        teacherPubKey,
        initialSupply: BigInt(1),
        symbol,
        questionHashIPFS,
        answerHashes,
        prizePool: BigInt(prizePool),
        entryFee: BigInt(entryFee),
        passThreshold,
        deadline: deadlineTimestamp,
        teacherRevealDeadline
      })

      const txId = await teacherComputer.broadcast(tx)
      const quiz = effect.res as any

      // Store in database
      await prisma.quiz.create({
        data: {
          contractId: quiz._id,
          contractRev: quiz._rev,
          txHash: txId,
          teacherId,
          symbol,
          questionHashIPFS,
          correctAnswers: JSON.stringify(correctAnswers),
          answerHashes: JSON.stringify(answerHashes),
          salt,
          questionCount: correctAnswers.length,
          prizePool: BigInt(prizePool),
          entryFee: BigInt(entryFee),
          passThreshold,
          deadline: new Date(deadlineTimestamp),
          teacherRevealDeadline: new Date(teacherRevealDeadline),
          status: 'ACTIVE',
          title: title || null,
          description: description || null
        }
      })

      return {
        success: true,
        quizId: quiz._id,
        quizRev: quiz._rev,
        txId,
        quiz: {
          id: quiz._id,
          symbol: quiz.symbol,
          entryFee: quiz.entryFee.toString(),
          prizePool: quiz.prizePool.toString(),
          passThreshold: quiz.passThreshold,
          status: quiz.status
        }
      }
    } catch (error) {
      console.error('Error in createQuiz service:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create quiz'
      }
    }
  }
}
