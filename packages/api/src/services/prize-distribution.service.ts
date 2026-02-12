/**
 * Prize Distribution Service
 * Business logic for prize distribution via atomic swap
 */

import { prisma } from '@bizz/database'
import { Computer, Transaction } from '@bitcoin-computer/lib'
import { AnswerProofHelper, PaymentHelper, PrizeSwapHelper } from '@bizz/sdk'

const { SIGHASH_SINGLE, SIGHASH_ANYONECANPAY } = Transaction

export class PrizeDistributionService {
  /**
   * Step 6a: Winner creates AnswerProof
   */
  static async createAnswerProof(
    studentComputer: Computer,
    params: { attemptId: string; answers: string[]; score: number; passed: boolean }
  ) {
    try {
      const { attemptId, answers, score, passed } = params

      // Get attempt
      const attempt = await prisma.quizAttempt.findUnique({
        where: { contractId: attemptId },
        include: { quiz: true }
      })

      if (!attempt) {
        return { success: false, error: 'Attempt not found' }
      }

      if (!attempt.passed) {
        return { success: false, error: 'Only winners can create answer proof' }
      }

      const studentPubKey = studentComputer.getPublicKey()

      // Create AnswerProof
      const proofHelper = new AnswerProofHelper(studentComputer)
      const { tx, effect } = await proofHelper.createAnswerProof({
        student: studentPubKey,
        quizRef: attempt.quiz.contractId,
        attemptRef: attemptId,
        answers,
        score,
        passed
      })

      const txId = await studentComputer.broadcast(tx)
      const answerProof = effect.res as any

      // Update database
      await prisma.quizAttempt.update({
        where: { id: attempt.id },
        data: {
          answerProofId: answerProof._id
        }
      })

      return {
        success: true,
        answerProofId: answerProof._id,
        answerProofRev: answerProof._rev,
        txId
      }
    } catch (error) {
      console.error('Error in createAnswerProof service:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create answer proof'
      }
    }
  }

  /**
   * Step 6b: Teacher creates prize Payment
   */
  static async createPrizePayment(
    teacherComputer: Computer,
    params: { attemptId: string; studentPubKey: string; amount: bigint }
  ) {
    try {
      const { attemptId, studentPubKey, amount } = params

      // Get attempt
      const attempt = await prisma.quizAttempt.findUnique({
        where: { contractId: attemptId }
      })

      if (!attempt) {
        return { success: false, error: 'Attempt not found' }
      }

      // Create prize Payment
      const paymentHelper = new PaymentHelper(teacherComputer)
      const { tx, effect } = await paymentHelper.createPayment({
        recipient: studentPubKey,
        amount,
        purpose: 'Prize Payment',
        reference: attemptId
      })

      const txId = await teacherComputer.broadcast(tx)
      const prizePayment = effect.res as any

      // Update database
      await prisma.quizAttempt.update({
        where: { id: attempt.id },
        data: {
          prizePaymentId: prizePayment._id,
          prizePaymentRev: prizePayment._rev
        }
      })

      return {
        success: true,
        prizePaymentId: prizePayment._id,
        prizePaymentRev: prizePayment._rev,
        txId
      }
    } catch (error) {
      console.error('Error in createPrizePayment service:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create prize payment'
      }
    }
  }

  /**
   * Step 6c: Prepare prize swap transaction
   * Teacher creates partially signed swap
   */
  static async preparePrizeSwap(
    teacherComputer: Computer,
    params: { attemptId: string }
  ) {
    try {
      const { attemptId } = params

      // Get attempt with prize payment and answer proof
      const attempt = await prisma.quizAttempt.findUnique({
        where: { contractId: attemptId }
      })

      if (!attempt || !attempt.prizePaymentId || !attempt.answerProofId) {
        return { success: false, error: 'Prize payment or answer proof not found' }
      }

      // Sync latest states
      const [prizePaymentRev] = await teacherComputer.query({ ids: [attempt.prizePaymentId] })
      const prizePayment = await teacherComputer.sync(prizePaymentRev)

      const [answerProofRev] = await teacherComputer.query({ ids: [attempt.answerProofId] })
      const answerProof = await teacherComputer.sync(answerProofRev)

      const [attemptRev] = await teacherComputer.query({ ids: [attemptId] })
      const syncedAttempt = await teacherComputer.sync(attemptRev)

      // Create partial swap transaction
      const swapHelper = new PrizeSwapHelper(teacherComputer)
      const { tx: partialSwapTx } = await swapHelper.createPrizeSwapTx(
        prizePayment,
        answerProof,
        syncedAttempt,
        SIGHASH_SINGLE | SIGHASH_ANYONECANPAY
      )

      return {
        success: true,
        partialSwapTx: partialSwapTx.toHex() // Serialize to hex
      }
    } catch (error) {
      console.error('Error in preparePrizeSwap service:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to prepare prize swap'
      }
    }
  }

  /**
   * Step 6d: Complete prize swap
   * Student funds, signs, and broadcasts
   */
  static async completePrizeSwap(
    studentComputer: Computer,
    params: { attemptId: string; partialSwapTx: string }
  ) {
    try {
      const { attemptId, partialSwapTx } = params

      // Get attempt
      const attempt = await prisma.quizAttempt.findUnique({
        where: { contractId: attemptId }
      })

      if (!attempt) {
        return { success: false, error: 'Attempt not found' }
      }

      // Complete swap transaction (deserialize from hex)
      const swapTx = Transaction.fromHex(partialSwapTx)
      await studentComputer.fund(swapTx)
      await studentComputer.sign(swapTx)
      const swapTxId = await studentComputer.broadcast(swapTx)

      // Update database
      await prisma.quizAttempt.update({
        where: { id: attempt.id },
        data: {
          status: 'PRIZE_CLAIMED'
        }
      })

      return {
        success: true,
        swapTxId
      }
    } catch (error) {
      console.error('Error in completePrizeSwap service:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to complete prize swap'
      }
    }
  }

  /**
   * Step 6e: Claim prize payment
   * Student releases satoshis from Payment contract to wallet
   */
  static async claimPrize(
    studentComputer: Computer,
    params: { prizePaymentId: string }
  ) {
    try {
      const { prizePaymentId } = params

      // Sync latest prize payment
      const [prizePaymentRev] = await studentComputer.query({ ids: [prizePaymentId] })
      const prizePayment = await studentComputer.sync(prizePaymentRev)

      // Claim payment
      const paymentHelper = new PaymentHelper(studentComputer)
      const { tx: claimTx } = await paymentHelper.claimPayment(prizePayment)

      const claimTxId = await studentComputer.broadcast(claimTx)

      return {
        success: true,
        claimTxId
      }
    } catch (error) {
      console.error('Error in claimPrize service:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to claim prize'
      }
    }
  }
}
