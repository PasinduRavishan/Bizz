import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { Computer, Transaction } from '@bitcoin-computer/lib'
import { CreateAnswerProofDto } from './dto/create-answer-proof.dto'
import { ExecuteSwapDto } from './dto/execute-swap.dto'
import { computerManager } from '../../common/computer-manager'

const { SIGHASH_SINGLE, SIGHASH_ANYONECANPAY } = Transaction

/**
 * PrizeService
 *
 * Handles prize distribution through atomic SWAP:
 * 1. Winner creates AnswerProof
 * 2. Teacher creates Prize Payment
 * 3. Atomic SWAP: Prize Payment → Student, AnswerProof → Teacher
 * 4. Student claims Prize Payment
 *
 * Flow (from tbc20.test.ts Phase 3):
 * - Winner creates AnswerProof with their answers and score
 * - Teacher creates Prize Payment for the winner
 * - Teacher creates partial SWAP tx (SIGHASH_SINGLE | SIGHASH_ANYONECANPAY)
 * - Student completes SWAP (fund → sign → broadcast)
 * - Student claims Prize Payment to release satoshis
 */
@Injectable()
export class PrizeService {
  private prisma: PrismaClient

  constructor() {
    this.prisma = new PrismaClient()
  }

  /**
   * Mine blocks in regtest mode (same as TestHelper.mineBlocks)
   */
  private async mineBlocks(computer: Computer, count: number = 1): Promise<void> {
    try {
      const newAddress = await computer.rpcCall('getnewaddress', 'mywallet legacy')
      console.log(`  ⛏️  Mining ${count} block(s)...`)
      await computer.rpcCall('generatetoaddress', `${count} ${newAddress.result}`)
      await new Promise(resolve => setTimeout(resolve, 500)) // Wait for block propagation (SAME as TestHelper)
    } catch (error) {
      console.error('  ❌ Error mining blocks:', (error as Error).message)
    }
  }

  /**
   * Winner creates AnswerProof contract
   *
   * Flow (from tbc20.test.ts line 573-600):
   * 1. Student creates AnswerProof with answers, score, passed
   * 2. Broadcast transaction
   * 3. AnswerProof owned by student (for now, will swap to teacher)
   */
  async createAnswerProof(studentId: string, dto: CreateAnswerProofDto) {
    // Find the quiz attempt — include answerCommitment, score, passed, and quiz questions
    const attempt = await this.prisma.quizAttempt.findUnique({
      where: { id: dto.attemptId },
      include: {
        student: {
          select: {
            id: true,
            encryptedMnemonic: true,
            publicKey: true,
          },
        },
        quiz: {
          select: {
            id: true,
            contractId: true,
            teacherId: true,
            questions: true,       // needed to reconstruct answer texts from indices
            passThreshold: true,
          },
        },
      },
    })

    if (!attempt) throw new NotFoundException('Quiz attempt not found')
    if (attempt.userId !== studentId) throw new ForbiddenException('Not your attempt')
    if (attempt.status !== 'VERIFIED') {
      throw new BadRequestException(`Attempt is ${attempt.status}, must be VERIFIED to create AnswerProof`)
    }
    if (!attempt.passed) {
      throw new BadRequestException('Only passing attempts can create AnswerProof')
    }

    // ── Reconstruct the student's answer texts from their commitment ──────────
    // The commitment format is: "commitment-[0,2,1,3]-<timestamp>"
    // Each index maps to the option text at that position in the question's options array.
    // This gives us the non-empty answers array the AnswerProof contract requires.
    let answers: string[]
    try {
      const commitment = attempt.answerCommitment
      if (!commitment) throw new Error('No answer commitment stored on this attempt')

      const match = commitment.match(/commitment-(\[[\d,\s]+\])-/)
      if (!match) throw new Error(`Cannot parse commitment format: ${commitment.substring(0, 60)}`)

      const studentIndices: number[] = JSON.parse(match[1])
      const questions = attempt.quiz.questions as Array<{ question: string; options: string[] }> | null

      if (!questions || questions.length === 0) {
        // Fallback: use index strings if questions not stored (shouldn't happen for UI-created quizzes)
        answers = studentIndices.map(idx => String(idx))
        console.warn('  ⚠️  No questions stored in DB — using index strings as answer proof')
      } else {
        answers = studentIndices.map((idx, i) => {
          const q = questions[i]
          return (q && q.options && q.options[idx] !== undefined) ? q.options[idx] : String(idx)
        })
      }

      console.log(`  📝 Reconstructed answers: ${JSON.stringify(answers)}`)
    } catch (e) {
      throw new BadRequestException(`Cannot reconstruct answers from commitment: ${(e as Error).message}`)
    }

    // Use the score/passed already computed and stored on the attempt (set by verifyAttempt)
    const score = attempt.score ?? 0
    const passed = attempt.passed ?? false

    try {
      // Get or create student's Computer instance (reused across all requests for this student)
      const studentComputer = computerManager.getComputer(attempt.student.encryptedMnemonic)

      console.log('📜 Creating AnswerProof...')

      // Import AnswerProofHelper
      const AnswerProofHelper = (await import('@bizz/contracts/deploy/AnswerProof.deploy.js')).AnswerProofHelper
      const proofHelper = new AnswerProofHelper(studentComputer, process.env.ANSWER_PROOF_MODULE_ID)

      // EXACT PATTERN from tbc20.test.ts lines 576-595:
      // 1. Create AnswerProof with reconstructed answer texts and server-computed score
      const { tx: proofTx, effect: proofEffect } = await proofHelper.createAnswerProof({
        student: attempt.student.publicKey,
        quizRef: attempt.quiz.contractId,
        attemptRef: attempt.contractId,
        answers,   // reconstructed from commitment indices
        score,     // from DB (computed server-side at verify time)
        passed,    // from DB (computed server-side at verify time)
      })

      // 2. Broadcast
      await studentComputer.broadcast(proofTx)

      // 3. Wait for mempool (200ms like TestHelper.waitForMempool)
      await new Promise(resolve => setTimeout(resolve, 200))

      const answerProof = proofEffect.res

      // 4. Mine to confirm
      await this.mineBlocks(studentComputer, 1)

      console.log(`✅ AnswerProof created: ${answerProof._id}`)
      console.log(`✅ Score: ${answerProof.score}%, Passed: ${answerProof.passed}`)

      // Update database
      await this.prisma.quizAttempt.update({
        where: { id: dto.attemptId },
        data: {
          answerProofId: answerProof._id,
        },
      })

      return {
        message: 'AnswerProof created successfully',
        answerProofId: answerProof._id,
        score,
        passed,
      }
    } catch (error) {
      console.error('Error creating AnswerProof:', error)
      throw new BadRequestException(`Failed to create AnswerProof: ${error.message}`)
    }
  }

  /**
   * Teacher creates Prize Payment for winner
   *
   * Flow (from tbc20.test.ts line 602-626):
   * 1. Teacher creates Payment contract with prize amount
   * 2. Payment owned by teacher (for now, will swap to student)
   */
  async createPrizePayment(teacherId: string, attemptId: string) {
    // Find the quiz attempt
    const attempt = await this.prisma.quizAttempt.findUnique({
      where: { id: attemptId },
      include: {
        student: {
          select: {
            id: true,
            publicKey: true,
          },
        },
        quiz: {
          select: {
            id: true,
            teacherId: true,
            prizePool: true,
            prizePerWinner: true,
            winnerCount: true,
          },
        },
      },
    })

    if (!attempt) throw new NotFoundException('Quiz attempt not found')
    if (attempt.quiz.teacherId !== teacherId) throw new ForbiddenException('Not your quiz')
    if (attempt.status !== 'VERIFIED') {
      throw new BadRequestException(`Attempt is ${attempt.status}, must be VERIFIED`)
    }
    if (!attempt.passed) {
      throw new BadRequestException('Student did not pass')
    }
    if (!attempt.answerProofId) {
      throw new BadRequestException('Student has not created AnswerProof yet')
    }

    try {
      // Get teacher's mnemonic
      const teacher = await this.prisma.user.findUnique({
        where: { id: teacherId },
        select: { encryptedMnemonic: true, publicKey: true },
      })

      if (!teacher || !teacher.encryptedMnemonic) {
        throw new BadRequestException('Teacher wallet not configured')
      }

      // Get or create teacher's Computer instance (reused across all requests for this teacher)
      const teacherComputer = computerManager.getComputer(teacher.encryptedMnemonic)

      // Use per-winner share; fall back to full pool if not yet calculated
      const prizeAmount: bigint = attempt.quiz.prizePerWinner != null
        ? attempt.quiz.prizePerWinner
        : attempt.quiz.prizePool
      const winnerCount = attempt.quiz.winnerCount ?? 1
      console.log(`💰 Creating Prize Payment: ${prizeAmount.toString()} sats (${winnerCount} winner(s) sharing pool)`)

      // Import PaymentHelper
      const PaymentHelper = (await import('@bizz/contracts/deploy/Payment.deploy.js')).PaymentHelper
      const paymentHelper = new PaymentHelper(teacherComputer, process.env.PAYMENT_MODULE_ID)

      // EXACT PATTERN from tbc20.test.ts lines 605-625:
      // 1. Create Prize Payment with correct per-winner amount
      const { tx: prizeTx, effect: prizeEffect } = await paymentHelper.createPayment({
        recipient: attempt.student.publicKey,
        amount: prizeAmount,
        purpose: 'Prize Payment',
        reference: attempt.contractId,
      })

      // 2. Broadcast
      await teacherComputer.broadcast(prizeTx)

      // 3. Wait for mempool (200ms like TestHelper.waitForMempool)
      await new Promise(resolve => setTimeout(resolve, 200))

      const prizePayment = prizeEffect.res

      // 4. Mine to confirm
      await this.mineBlocks(teacherComputer, 1)

      console.log(`✅ Prize Payment created: ${prizePayment._id}`)
      console.log(`✅ Amount: ${prizeAmount.toString()} sats`)

      // Update database — store the actual prize amount awarded
      await this.prisma.quizAttempt.update({
        where: { id: attemptId },
        data: {
          prizePaymentId: prizePayment._id,
          prizePaymentRev: prizePayment._rev,
          prizeAmount,
        },
      })

      return {
        message: 'Prize Payment created successfully',
        prizePaymentId: prizePayment._id,
        amount: Number(prizeAmount),
        winnerCount,
      }
    } catch (error) {
      console.error('Error creating Prize Payment:', error)
      throw new BadRequestException(`Failed to create Prize Payment: ${error.message}`)
    }
  }

  /**
   * Teacher creates partial SWAP transaction
   *
   * Flow (from tbc20.test.ts line 628-651):
   * 1. Teacher creates partial SWAP tx with SIGHASH_SINGLE | SIGHASH_ANYONECANPAY
   * 2. Returns partial tx hex for student to complete
   */
  async createSwapTransaction(teacherId: string, attemptId: string) {
    // Find the quiz attempt
    const attempt = await this.prisma.quizAttempt.findUnique({
      where: { id: attemptId },
      include: {
        quiz: {
          select: {
            teacherId: true,
          },
        },
      },
    })

    if (!attempt) throw new NotFoundException('Quiz attempt not found')
    if (attempt.quiz.teacherId !== teacherId) throw new ForbiddenException('Not your quiz')
    if (!attempt.answerProofId) {
      throw new BadRequestException('AnswerProof not created yet')
    }
    if (!attempt.prizePaymentId) {
      throw new BadRequestException('Prize Payment not created yet')
    }

    try {
      // Get teacher's mnemonic
      const teacher = await this.prisma.user.findUnique({
        where: { id: teacherId },
        select: { encryptedMnemonic: true },
      })

      if (!teacher || !teacher.encryptedMnemonic) {
        throw new BadRequestException('Teacher wallet not configured')
      }

      // Get or create teacher's Computer instance (reused across all requests for this teacher)
      const teacherComputer = computerManager.getComputer(teacher.encryptedMnemonic)

      console.log('📝 Creating SWAP transaction...')

      // Import PrizeSwapHelper
      const PrizeSwapHelper = (await import('@bizz/contracts/deploy/PrizeSwap.deploy.js')).PrizeSwapHelper
      const swapHelper = new PrizeSwapHelper(teacherComputer, process.env.PRIZE_SWAP_MODULE_ID)

      // EXACT PATTERN from tbc20.test.ts lines 640-649:
      // Sync prize payment
      const [prizePaymentRev] = await teacherComputer.query({ ids: [attempt.prizePaymentId] })
      const prizePayment = await teacherComputer.sync(prizePaymentRev)

      // Sync answer proof
      const [answerProofRev] = await teacherComputer.query({ ids: [attempt.answerProofId] })
      const answerProof = await teacherComputer.sync(answerProofRev)

      // Sync latest attempt state to ensure it's verified
      const [attemptRev] = await teacherComputer.query({ ids: [attempt.contractId] })
      const syncedAttempt = await teacherComputer.sync(attemptRev)

      // Create partial SWAP transaction with SIGHASH flags
      const { tx: swapTx } = await swapHelper.createPrizeSwapTx(
        prizePayment,
        answerProof,
        syncedAttempt,
        SIGHASH_SINGLE | SIGHASH_ANYONECANPAY
      )

      const partialTxHex = swapTx.toHex()

      console.log('✅ Partial SWAP transaction created')

      // Store partial tx in database
      await this.prisma.quizAttempt.update({
        where: { id: attemptId },
        data: {
          swapTxHex: partialTxHex,
        },
      })

      return {
        message: 'Partial SWAP transaction created',
        partialTxHex,
      }
    } catch (error) {
      console.error('Error creating SWAP transaction:', error)
      throw new BadRequestException(`Failed to create SWAP transaction: ${error.message}`)
    }
  }

  /**
   * Student completes SWAP transaction AND immediately claims the Prize Payment
   *
   * Flow (from tbc20.test.ts line 653-714):
   * 1. Student funds partial SWAP tx
   * 2. Student signs SWAP tx
   * 3. Student broadcasts SWAP tx
   * 4. Atomic swap: Prize Payment → Student, AnswerProof → Teacher
   * 5. Student calls Payment.claim() → releases satoshis to student's wallet
   * 6. Attempt status → 'PRIZE_CLAIMED'
   *
   * Both steps are combined in one backend call so the student only clicks once.
   */
  async executeSwap(studentId: string, attemptId: string) {
    // Find the quiz attempt
    const attempt = await this.prisma.quizAttempt.findUnique({
      where: { id: attemptId },
      include: {
        student: {
          select: {
            id: true,
            encryptedMnemonic: true,
            publicKey: true,
          },
        },
        quiz: {
          select: {
            prizePool: true,
            prizePerWinner: true,
          },
        },
      },
    })

    if (!attempt) throw new NotFoundException('Quiz attempt not found')
    if (attempt.userId !== studentId) throw new ForbiddenException('Not your attempt')
    if (!attempt.swapTxHex) {
      throw new BadRequestException('SWAP transaction not created by teacher yet')
    }

    try {
      // Get or create student's Computer instance (reused across all requests for this student)
      const studentComputer = computerManager.getComputer(attempt.student.encryptedMnemonic)

      console.log('🔐 Student completing SWAP...')

      // EXACT PATTERN from tbc20.test.ts lines 653-680:
      // Parse partial tx
      const swapTx = Transaction.fromHex(attempt.swapTxHex)

      // Fund, sign, and broadcast
      await studentComputer.fund(swapTx)
      await studentComputer.sign(swapTx)
      await studentComputer.broadcast(swapTx)

      // Wait for mempool (200ms like TestHelper.waitForMempool)
      await new Promise(resolve => setTimeout(resolve, 200))

      // Mine to confirm swap
      await this.mineBlocks(studentComputer, 1)

      console.log('✅ SWAP executed successfully!')

      // Sync to get updated prize payment (now owned by student)
      const [latestPrizeRev] = await studentComputer.query({ ids: [attempt.prizePaymentId] })
      const prizePayment = await studentComputer.sync(latestPrizeRev)

      const [latestAttemptRev] = await studentComputer.query({ ids: [attempt.contractId] })
      const finalAttempt = await studentComputer.sync(latestAttemptRev)

      console.log(`✅ Prize Payment now owned by: Student`)
      console.log(`✅ Attempt status: ${finalAttempt.status}`)

      // ── Immediately claim the prize payment to release sats to student wallet ──
      console.log('💰 Claiming prize payment to release sats...')

      const PaymentHelper = (await import('@bizz/contracts/deploy/Payment.deploy.js')).PaymentHelper
      const paymentHelper = new PaymentHelper(studentComputer, process.env.PAYMENT_MODULE_ID)

      // Claim payment — releases satoshis from contract to student's wallet
      const { tx: claimTx } = await paymentHelper.claimPayment(prizePayment)
      await studentComputer.broadcast(claimTx)

      // Wait for mempool
      await new Promise(resolve => setTimeout(resolve, 200))

      // Mine to confirm claim
      await this.mineBlocks(studentComputer, 1)

      // Sync to get final prize state
      const [claimedPrizeRev] = await studentComputer.query({ ids: [attempt.prizePaymentId] })
      const claimedPrize = await studentComputer.sync(claimedPrizeRev)

      console.log(`✅ Prize claimed! Payment status: ${claimedPrize.status}`)
      console.log(`✅ Sats released to student wallet`)

      // Update database — fully claimed
      await this.prisma.quizAttempt.update({
        where: { id: attemptId },
        data: {
          status: 'PRIZE_CLAIMED',
          prizePaymentRev: claimedPrize._rev,
          contractRev: finalAttempt._rev,
        },
      })

      // Use the actual per-attempt prize amount stored when the prize payment was created.
      // Fall back to prizePerWinner → prizePool in case prizeAmount was not stored yet.
      const satsClaimed = attempt.prizeAmount != null
        ? Number(attempt.prizeAmount)
        : attempt.quiz.prizePerWinner != null
        ? Number(attempt.quiz.prizePerWinner)
        : Number(attempt.quiz.prizePool)

      return {
        message: 'SWAP executed and prize claimed successfully',
        prizePaymentId: attempt.prizePaymentId,
        status: 'prize_claimed',
        satsClaimed,
      }
    } catch (error) {
      console.error('Error executing SWAP:', error)
      throw new BadRequestException(`Failed to execute SWAP: ${error.message}`)
    }
  }

  /**
   * Student claims Prize Payment to release satoshis
   *
   * Flow (from tbc20.test.ts line 681-714):
   * 1. Student calls Payment.claim()
   * 2. Satoshis released from Payment contract to student's wallet
   * 3. Payment status → 'claimed'
   */
  async claimPrize(studentId: string, attemptId: string) {
    // Find the quiz attempt
    const attempt = await this.prisma.quizAttempt.findUnique({
      where: { id: attemptId },
      include: {
        student: {
          select: {
            id: true,
            encryptedMnemonic: true,
          },
        },
        quiz: {
          select: {
            prizePool: true,
          },
        },
      },
    })

    if (!attempt) throw new NotFoundException('Quiz attempt not found')
    if (attempt.userId !== studentId) throw new ForbiddenException('Not your attempt')
    if (attempt.status !== 'PRIZE_CLAIMED') {
      throw new BadRequestException(`Attempt is ${attempt.status}, must be PRIZE_CLAIMED to claim prize`)
    }
    if (!attempt.prizePaymentId) {
      throw new BadRequestException('No prize payment found')
    }

    try {
      // Get or create student's Computer instance (reused across all requests for this student)
      const studentComputer = computerManager.getComputer(attempt.student.encryptedMnemonic)

      console.log('💰 Claiming prize payment...')

      // Import PaymentHelper
      const PaymentHelper = (await import('@bizz/contracts/deploy/Payment.deploy.js')).PaymentHelper
      const paymentHelper = new PaymentHelper(studentComputer, process.env.PAYMENT_MODULE_ID)

      // EXACT PATTERN from tbc20.test.ts lines 681-714:
      // Sync prize payment
      const [prizePaymentRev] = await studentComputer.query({ ids: [attempt.prizePaymentId] })
      const prizePayment = await studentComputer.sync(prizePaymentRev)

      // Claim payment
      const { tx: claimTx } = await paymentHelper.claimPayment(prizePayment)

      // Broadcast
      await studentComputer.broadcast(claimTx)

      // Wait for mempool (200ms like TestHelper.waitForMempool)
      await new Promise(resolve => setTimeout(resolve, 200))

      // Mine to confirm
      await this.mineBlocks(studentComputer, 1)

      // Sync to get updated payment
      const [claimedPrizeRev] = await studentComputer.query({ ids: [attempt.prizePaymentId] })
      const claimedPrize = await studentComputer.sync(claimedPrizeRev)

      console.log(`✅ Prize claimed! Payment status: ${claimedPrize.status}`)
      console.log(`✅ Released ${attempt.quiz.prizePool - claimedPrize._satoshis} sats to wallet`)

      return {
        message: 'Prize claimed successfully',
        prizePaymentId: attempt.prizePaymentId,
        status: claimedPrize.status,
      }
    } catch (error) {
      console.error('Error claiming prize:', error)
      throw new BadRequestException(`Failed to claim prize: ${error.message}`)
    }
  }
}
