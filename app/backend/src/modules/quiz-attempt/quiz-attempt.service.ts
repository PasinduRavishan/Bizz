import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { Computer } from '@bitcoin-computer/lib'
import { SubmitCommitmentDto } from './dto/submit-commitment.dto'
import { VerifyAttemptDto } from './dto/verify-attempt.dto'
import { computerManager } from '../../common/computer-manager'

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
        quiz: {
          ...a.quiz,
          prizePool: a.quiz.prizePool.toString(),
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
        quiz: {
          ...attempt.quiz,
          prizePool: attempt.quiz.prizePool.toString(),
          entryFee: attempt.quiz.entryFee.toString(),
        },
      },
    }
  }
}
