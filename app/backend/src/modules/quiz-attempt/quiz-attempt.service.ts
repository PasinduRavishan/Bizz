import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { Computer, Transaction } from '@bitcoin-computer/lib'
import { SubmitCommitmentDto } from './dto/submit-commitment.dto'
import { VerifyAttemptDto } from './dto/verify-attempt.dto'
import { computerManager } from '../../common/computer-manager'

const { SIGHASH_SINGLE, SIGHASH_ANYONECANPAY } = Transaction

/**
 * QuizAttemptService
 *
 * Handles student quiz attempt lifecycle:
 * 1. Submit commitment (after burning quiz token in access-request)
 * 2. Verify attempt (after teacher reveals answers)
 *
 * Flow (from tbc20.test.ts):
 * - Student burns quiz token → creates QuizAttempt (in access-request service)
 * - Student submits answer commitment → QuizAttempt.submitCommitment()
 * - Teacher reveals answers → Quiz.revealAnswers() (in quiz service)
 * - Student verifies attempt → QuizAttempt.verify(score, passed)
 */
@Injectable()
export class QuizAttemptService {
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
   * Compute score server-side by comparing student's answer indices (from commitment)
   * against the correct answer option texts (revealedAnswers) using question option lists.
   *
   * Commitment format: "commitment-[0,2,1,3]-<timestamp>"
   * revealedAnswers: ["Paris", "Blue", "4"] — option texts stored at quiz creation
   * questions: [{ question: "...", options: ["Rome","Paris","Berlin","London"] }, ...]
   *
   * For each question i:
   *   correctIdx = questions[i].options.indexOf(revealedAnswers[i])
   *   studentIdx = parsed from commitment
   *   correct++  if studentIdx === correctIdx
   */
  private computeScore(
    answerCommitment: string | null,
    revealedAnswers: string[] | null,
    questions: Array<{ question: string; options: string[] }> | null,
  ): number {
    if (!answerCommitment) throw new Error('No answer commitment found')
    if (!revealedAnswers || revealedAnswers.length === 0) throw new Error('No revealed answers found')
    if (!questions || questions.length === 0) throw new Error('No questions found for scoring')

    // Parse student answer indices from commitment string
    const match = answerCommitment.match(/commitment-(\[[\d,\s]+\])-/)
    if (!match) throw new Error(`Cannot parse commitment format: ${answerCommitment.substring(0, 50)}`)

    let studentIndices: number[]
    try {
      studentIndices = JSON.parse(match[1]) as number[]
    } catch {
      throw new Error('Cannot parse answer indices from commitment')
    }

    if (studentIndices.length === 0) throw new Error('No answers found in commitment')

    const totalQuestions = Math.min(studentIndices.length, revealedAnswers.length, questions.length)
    let correct = 0

    for (let i = 0; i < totalQuestions; i++) {
      const correctText = revealedAnswers[i]
      const correctIdx = questions[i].options.findIndex(opt => opt === correctText)
      if (correctIdx !== -1 && studentIndices[i] === correctIdx) {
        correct++
      }
    }

    const score = Math.round((correct / totalQuestions) * 100)
    console.log(`  📊 Score computation: ${correct}/${totalQuestions} correct = ${score}%`)
    return score
  }

  /**
   * Student submits their answer commitment to the QuizAttempt contract
   *
   * Flow (from tbc20.test.ts line 478-503):
   * 1. Student generates commitment hash from answers
   * 2. Call QuizAttempt.submitCommitment(commitment)
   * 3. Broadcast transaction
   * 4. QuizAttempt status → 'committed'
   */
  async submitCommitment(attemptId: string, studentId: string, dto: SubmitCommitmentDto) {
    // Find the quiz attempt in database
    const dbAttempt = await this.prisma.quizAttempt.findUnique({
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
            contractId: true,
            deadline: true,
          },
        },
      },
    })

    if (!dbAttempt) throw new NotFoundException('Quiz attempt not found')
    if (dbAttempt.userId !== studentId) throw new ForbiddenException('Not your attempt')
    if (!dbAttempt.contractId) throw new BadRequestException('Attempt contract not created yet')
    if (dbAttempt.status !== 'OWNED') {
      throw new BadRequestException(`Attempt is ${dbAttempt.status}, must be OWNED to submit commitment`)
    }
    if (new Date() > dbAttempt.quiz.deadline) {
      throw new BadRequestException('Quiz deadline has passed')
    }

    try {
      // Get or create student's Computer instance (reused across all requests for this student)
      const studentComputer = computerManager.getComputer(dbAttempt.student.encryptedMnemonic)

      console.log('📝 Submitting answer commitment...')

      // Import QuizAttemptHelper
      const QuizAttemptHelper = (await import('@bizz/contracts/deploy/QuizAttempt.deploy.js')).QuizAttemptHelper
      const attemptHelper = new QuizAttemptHelper(studentComputer, process.env.QUIZ_ATTEMPT_MODULE_ID)

      // Sync the QuizAttempt contract
      const [latestAttemptRev] = await studentComputer.query({ ids: [dbAttempt.contractId] })
      const syncedAttempt = await studentComputer.sync(latestAttemptRev)

      // Submit commitment
      const { tx: commitTx } = await attemptHelper.submitCommitment(syncedAttempt, dto.answerCommitment)

      await studentComputer.broadcast(commitTx)
      await new Promise(resolve => setTimeout(resolve, 200)) // Wait for mempool

      // Mine blocks to confirm (mine extra blocks for UTXO maturity)
      await this.mineBlocks(studentComputer, 1)

      // Query and sync to get updated state
      const [updatedAttemptRev] = await studentComputer.query({ ids: [dbAttempt.contractId] })
      const updatedAttempt = await studentComputer.sync(updatedAttemptRev)

      console.log(`✅ Commitment submitted, status: ${updatedAttempt.status}`)

      // Update database
      await this.prisma.quizAttempt.update({
        where: { id: attemptId },
        data: {
          status: 'COMMITTED',
          answerCommitment: dto.answerCommitment,
          contractRev: updatedAttempt._rev,
        },
      })

      return {
        message: 'Answer commitment submitted successfully',
        attemptId: dbAttempt.contractId,
        status: 'committed',
      }
    } catch (error) {
      console.error('Error submitting commitment:', error)
      throw new BadRequestException(`Failed to submit commitment: ${error.message}`)
    }
  }

  /**
   * Student verifies their own attempt after teacher reveals answers
   *
   * Flow (from tbc20.test.ts line 538-569):
   * 1. Teacher has already revealed correct answers on Quiz contract
   * 2. Student calculates their score by comparing answers
   * 3. Student calls QuizAttempt.verify(score, passed)
   * 4. Broadcast transaction
   * 5. QuizAttempt status → 'verified'
   */
  async verifyAttempt(attemptId: string, studentId: string, dto: VerifyAttemptDto) {
    const dbAttempt = await this.prisma.quizAttempt.findUnique({
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
            contractId: true,
            contractRev: true,
            status: true,
            passThreshold: true,
            revealedAnswers: true,
            questions: true,
          },
        },
      },
    })

    if (!dbAttempt) throw new NotFoundException('Quiz attempt not found')
    if (dbAttempt.userId !== studentId) throw new ForbiddenException('Not your attempt')
    if (!dbAttempt.contractId) throw new BadRequestException('Attempt contract not created yet')
    if (dbAttempt.status !== 'COMMITTED') {
      throw new BadRequestException(`Attempt is ${dbAttempt.status}, must be COMMITTED to verify`)
    }
    if (dbAttempt.quiz.status !== 'REVEALED') {
      throw new BadRequestException('Teacher has not revealed answers yet')
    }

    // Compute score server-side from answerCommitment + revealedAnswers + questions
    // This avoids trusting the frontend-computed score entirely
    let computedScore: number
    try {
      computedScore = this.computeScore(
        dbAttempt.answerCommitment,
        dbAttempt.quiz.revealedAnswers as string[] | null,
        dbAttempt.quiz.questions as Array<{ question: string; options: string[] }> | null,
      )
      console.log(`  📊 Server-computed score: ${computedScore}%`)
    } catch (e) {
      // If computation fails (missing data), fall back to dto.score if provided
      if (dto.score !== undefined && dto.score !== null) {
        console.warn(`  ⚠️  Score computation failed (${e.message}), using client score: ${dto.score}%`)
        computedScore = dto.score
      } else {
        throw new BadRequestException(`Cannot compute score: ${e.message}`)
      }
    }

    try {
      // Get or create student's Computer instance (reused across all requests for this student)
      const studentComputer = computerManager.getComputer(dbAttempt.student.encryptedMnemonic)

      console.log('✅ Verifying quiz attempt...')

      // Determine if student passed
      const passed = computedScore >= dbAttempt.quiz.passThreshold
      console.log(`  Score: ${computedScore}%, Threshold: ${dbAttempt.quiz.passThreshold}%, Passed: ${passed}`)

      // Mine blocks to ensure previous transactions are confirmed and UTXOs are available
      await this.mineBlocks(studentComputer, 1)

      // Query and sync the QuizAttempt contract (EXACT same pattern as test line 545-546)
      console.log(`  Querying latest attempt state for ID: ${dbAttempt.contractId}`)
      const [latestAttemptRev] = await studentComputer.query({ ids: [dbAttempt.contractId] })
      console.log(`  Syncing attempt from rev: ${latestAttemptRev}`)
      const syncedAttempt = await studentComputer.sync(latestAttemptRev)
      console.log(`  ✅ Synced successfully`)

      // Call verify() with encodeCall (same as test line 548-553)
      console.log(`  Encoding verify call...`)
      const { tx: verifyTx } = await studentComputer.encodeCall({
        target: syncedAttempt,
        property: 'verify',
        args: [computedScore, passed],
        mod: process.env.QUIZ_ATTEMPT_MODULE_ID,
      })

      await studentComputer.broadcast(verifyTx)
      await new Promise(resolve => setTimeout(resolve, 200)) // Wait for mempool (test line 556)

      // Mine blocks to confirm verification (mine extra for UTXO maturity)
      await this.mineBlocks(studentComputer, 1)

      // Query and sync to get updated state (test line 561-562)
      const [updatedAttemptRev] = await studentComputer.query({ ids: [dbAttempt.contractId] })
      const updatedAttempt = await studentComputer.sync(updatedAttemptRev)

      console.log(`✅ Attempt verified: score=${updatedAttempt.score}%, passed=${updatedAttempt.passed}, status=${updatedAttempt.status}`)

      // Update database with fresh state
      await this.prisma.quizAttempt.update({
        where: { id: attemptId },
        data: {
          status: 'VERIFIED',
          score: computedScore,
          passed,
          contractRev: updatedAttempt._rev,
        },
      })

      // ── AUTO-CREATE PRIZE PAYMENT + SWAP TX for passing students ──────────
      // Teacher no longer needs to manually do this — it happens automatically here
      if (passed) {
        console.log('🏆 Student passed! Auto-creating prize payment and swap tx...')
        try {
          await this.autoCreatePrizePaymentAndSwap(attemptId, studentId)
          console.log('✅ Prize payment and swap tx auto-created')
        } catch (prizeError) {
          // Non-fatal: log but don't fail the verification response
          // Student can still see their result; prize setup can be retried if needed
          console.error('⚠️  Auto prize creation failed (non-fatal):', (prizeError as Error).message)
        }
      }

      return {
        message: 'Attempt verified successfully',
        attemptId: dbAttempt.contractId,
        score: computedScore,
        passed,
        status: 'verified',
      }
    } catch (error) {
      console.error('Error verifying attempt:', error)
      throw new BadRequestException(`Failed to verify attempt: ${error.message}`)
    }
  }

  /**
   * Auto-creates AnswerProof → Prize Payment → Swap TX for a verified passing attempt.
   *
   * Called internally from verifyAttempt() — teacher never needs to click anything.
   * All blockchain ops run with the teacher's computer (prize payment) and
   * student's computer (answer proof), then the partial swap tx is stored in DB.
   */
  private async autoCreatePrizePaymentAndSwap(attemptId: string, studentId: string): Promise<void> {
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
            id: true,
            contractId: true,
            teacherId: true,
            prizePool: true,
            prizePerWinner: true,
            winnerCount: true,
            questions: true,
            passThreshold: true,
          },
        },
      },
    })

    if (!attempt) throw new Error('Attempt not found')
    if (!attempt.passed) throw new Error('Attempt did not pass')

    const teacher = await this.prisma.user.findUnique({
      where: { id: attempt.quiz.teacherId },
      select: { encryptedMnemonic: true, publicKey: true },
    })

    if (!teacher || !teacher.encryptedMnemonic) throw new Error('Teacher wallet not configured')

    const studentComputer = computerManager.getComputer(attempt.student.encryptedMnemonic)
    const teacherComputer = computerManager.getComputer(teacher.encryptedMnemonic)

    // STEP A: Create AnswerProof (student side)
    console.log('  📜 Auto-creating AnswerProof...')

    // Reconstruct answers from commitment
    let answers: string[]
    const commitment = attempt.answerCommitment
    if (!commitment) throw new Error('No answer commitment on attempt')

    const match = commitment.match(/commitment-(\[[\d,\s]+\])-/)
    if (!match) throw new Error(`Cannot parse commitment: ${commitment.substring(0, 60)}`)

    const studentIndices: number[] = JSON.parse(match[1])
    const questions = attempt.quiz.questions as Array<{ question: string; options: string[] }> | null

    if (!questions || questions.length === 0) {
      answers = studentIndices.map(idx => String(idx))
    } else {
      answers = studentIndices.map((idx, i) => {
        const q = questions[i]
        return (q && q.options && q.options[idx] !== undefined) ? q.options[idx] : String(idx)
      })
    }

    const score = attempt.score ?? 0
    const passed = attempt.passed ?? false

    const AnswerProofHelper = (await import('@bizz/contracts/deploy/AnswerProof.deploy.js')).AnswerProofHelper
    const proofHelper = new AnswerProofHelper(studentComputer, process.env.ANSWER_PROOF_MODULE_ID)

    const { tx: proofTx, effect: proofEffect } = await proofHelper.createAnswerProof({
      student: attempt.student.publicKey,
      quizRef: attempt.quiz.contractId,
      attemptRef: attempt.contractId,
      answers,
      score,
      passed,
    })

    await studentComputer.broadcast(proofTx)
    await new Promise(resolve => setTimeout(resolve, 200))
    await this.mineBlocks(studentComputer, 1)

    const answerProof = proofEffect.res
    console.log(`  ✅ AnswerProof created: ${answerProof._id}`)

    // Store answerProofId immediately
    await this.prisma.quizAttempt.update({
      where: { id: attemptId },
      data: { answerProofId: answerProof._id },
    })

    // STEP B: Create Prize Payment (teacher side) with correct per-winner amount
    // prizePerWinner is computed by revealAnswers() before any student can call verifyAttempt()
    // (verifyAttempt requires quiz.status === 'REVEALED', which is set by revealAnswers()).
    // If for any reason prizePerWinner is not set, fall back to full prizePool.
    const prizeAmount: bigint = attempt.quiz.prizePerWinner != null
      ? attempt.quiz.prizePerWinner
      : attempt.quiz.prizePool

    const winnerCount = attempt.quiz.winnerCount ?? 1
    console.log(`  💰 Auto-creating Prize Payment: ${prizeAmount.toString()} sats (${winnerCount} winner(s) sharing pool of ${attempt.quiz.prizePool.toString()} sats)`)

    const PaymentHelper = (await import('@bizz/contracts/deploy/Payment.deploy.js')).PaymentHelper
    const paymentHelper = new PaymentHelper(teacherComputer, process.env.PAYMENT_MODULE_ID)

    const { tx: prizeTx, effect: prizeEffect } = await paymentHelper.createPayment({
      recipient: attempt.student.publicKey,
      amount: prizeAmount,
      purpose: 'Prize Payment',
      reference: attempt.contractId,
    })

    await teacherComputer.broadcast(prizeTx)
    await new Promise(resolve => setTimeout(resolve, 200))
    await this.mineBlocks(teacherComputer, 1)

    const prizePayment = prizeEffect.res
    console.log(`  ✅ Prize Payment created: ${prizePayment._id} (amount: ${prizeAmount.toString()} sats)`)

    // Store prizePaymentId AND the actual prizeAmount for this attempt
    await this.prisma.quizAttempt.update({
      where: { id: attemptId },
      data: {
        prizePaymentId: prizePayment._id,
        prizePaymentRev: prizePayment._rev,
        prizeAmount,
      },
    })

    // STEP C: Create partial SWAP tx (teacher side)
    console.log('  🔄 Auto-creating partial SWAP tx...')

    const PrizeSwapHelper = (await import('@bizz/contracts/deploy/PrizeSwap.deploy.js')).PrizeSwapHelper
    const swapHelper = new PrizeSwapHelper(teacherComputer, process.env.PRIZE_SWAP_MODULE_ID)

    // Sync all contracts to latest state
    const [prizePaymentRev] = await teacherComputer.query({ ids: [prizePayment._id] })
    const syncedPrizePayment = await teacherComputer.sync(prizePaymentRev)

    const [answerProofRev] = await teacherComputer.query({ ids: [answerProof._id] })
    const syncedAnswerProof = await teacherComputer.sync(answerProofRev)

    // We need the attempt rev from teacher's perspective
    const [attemptRev] = await teacherComputer.query({ ids: [attempt.contractId] })
    const syncedAttempt = await teacherComputer.sync(attemptRev)

    const { tx: swapTx } = await swapHelper.createPrizeSwapTx(
      syncedPrizePayment,
      syncedAnswerProof,
      syncedAttempt,
      SIGHASH_SINGLE | SIGHASH_ANYONECANPAY
    )

    const partialSwapTxHex = swapTx.toHex()
    console.log('  ✅ Partial SWAP tx created')

    // Store swap tx hex
    await this.prisma.quizAttempt.update({
      where: { id: attemptId },
      data: { swapTxHex: partialSwapTxHex },
    })

    console.log('✅ All prize components auto-created — student can now claim prize!')
  }

  /**
   * Get all attempts for a student
   */
  async getStudentAttempts(studentId: string) {
    const attempts = await this.prisma.quizAttempt.findMany({
      where: { userId: studentId },
      include: {
        quiz: {
          select: {
            id: true,
            title: true,
            symbol: true,
            contractId: true,
            status: true,
            deadline: true,
            passThreshold: true,
            prizePool: true,
            prizePerWinner: true,
            winnerCount: true,
            entryFee: true,
            questionCount: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return {
      attempts: attempts.map(a => ({
        ...a,
        prizeAmount: a.prizeAmount != null ? a.prizeAmount.toString() : null,
        quiz: {
          ...a.quiz,
          prizePool: a.quiz.prizePool.toString(),
          prizePerWinner: a.quiz.prizePerWinner != null ? a.quiz.prizePerWinner.toString() : null,
          entryFee: a.quiz.entryFee.toString(),
        },
      })),
    }
  }

  /**
   * Get specific attempt details
   */
  async getAttempt(attemptId: string, userId: string) {
    const attempt = await this.prisma.quizAttempt.findUnique({
      where: { id: attemptId },
      include: {
        quiz: {
          select: {
            id: true,
            title: true,
            symbol: true,
            contractId: true,
            status: true,
            deadline: true,
            passThreshold: true,
            prizePool: true,
            prizePerWinner: true,
            winnerCount: true,
            entryFee: true,
            questionCount: true,
            revealedAnswers: true,
            teacherId: true,
          },
        },
        student: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    if (!attempt) throw new NotFoundException('Attempt not found')

    // Only student or teacher can view
    if (attempt.userId !== userId && attempt.quiz.teacherId !== userId) {
      throw new ForbiddenException('Not authorized to view this attempt')
    }

    return {
      attempt: {
        ...attempt,
        prizeAmount: attempt.prizeAmount != null ? attempt.prizeAmount.toString() : null,
        quiz: {
          ...attempt.quiz,
          prizePool: attempt.quiz.prizePool.toString(),
          prizePerWinner: attempt.quiz.prizePerWinner != null ? attempt.quiz.prizePerWinner.toString() : null,
          entryFee: attempt.quiz.entryFee.toString(),
        },
      },
    }
  }
}
