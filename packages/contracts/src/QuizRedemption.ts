// TypeScript version for local development (not used for deployment)
// Bitcoin Computer requires JavaScript without imports
// For deployment, use the JS version or strip types
// @ts-expect-error - Bitcoin Computer library type definitions issue
import { Contract } from '@bitcoin-computer/lib'

// Type for Quiz token contract
interface Quiz extends Contract {
  _id: string
  _owners: string[]
  _satoshis: bigint
  amount: bigint
  symbol: string
  teacher: string
  originalQuizId: string
  burn(): void
}

// Type for QuizAttempt contract
interface QuizAttempt extends Contract {
  _id: string
  _owners: string[]
  student: string
  quizRef: string
  answerCommitment: string
  quizTeacher: string
  entryFee: bigint
  score: number | null
  passed: boolean | null
  status: string
  submitTimestamp: number
  claimedAt: number | null
  version: string
  isRedeemed: boolean
  markAsRedeemed(): void
}

/**
 * QuizRedemption - Convert Quiz Token → QuizAttempt
 *
 * Student redeems their Quiz fungible token to create/unlock a QuizAttempt.
 * This enforces that students MUST own a quiz token before submitting answers.
 *
 * Process:
 * 1. Student owns 1 Quiz token (received via QuizAccess.exec)
 * 2. Student creates QuizAttempt (owned status)
 * 3. Student calls QuizRedemption.redeem(quizToken, quizAttempt)
 * 4. Quiz token gets burned (amount set to 0)
 * 5. QuizAttempt marked as redeemed (isRedeemed = true)
 * 6. Student can now submit answers
 *
 * Security:
 * - Prevents students from creating multiple attempts with one quiz token
 * - Ensures quiz token ownership before allowing quiz attempts
 * - Burns quiz token to prevent reuse
 */
export class QuizRedemption extends Contract {
  /**
   * Redeem quiz token to unlock quiz attempt
   *
   * @param quizToken - Student's Quiz fungible token (must own 1)
   * @param quizAttempt - Student's QuizAttempt (must be owned status)
   * @returns [Burned quiz token, Redeemed quiz attempt]
   */
  static redeem(
    quizToken: Quiz,
    quizAttempt: QuizAttempt
  ): [Quiz, QuizAttempt] {
    const [student] = quizToken._owners

    // Validation: Student must own the quiz token
    if (!student) {
      throw new Error('Quiz token must be owned by student')
    }

    // Validation: Must have exactly 1 quiz token
    if (quizToken.amount !== 1n) {
      throw new Error('Must have exactly 1 quiz token to redeem')
    }

    // Validation: Check symbol (should be quiz symbol like "MATH101")
    if (!quizToken.symbol) {
      throw new Error('Invalid quiz token symbol')
    }

    // Validation: QuizAttempt must be owned by same student
    const [attemptOwner] = quizAttempt._owners
    if (attemptOwner !== student) {
      throw new Error('QuizAttempt must be owned by quiz token owner')
    }

    // Validation: QuizAttempt must be for the same quiz as the token
    // Use originalQuizId since transferred tokens have different _id
    const quizId = quizToken.originalQuizId || quizToken._id
    if (quizAttempt.quizRef !== quizId) {
      throw new Error('QuizAttempt must be for the same quiz as the token')
    }

    // Validation: QuizAttempt must be in 'owned' status (not yet used)
    if (quizAttempt.status !== 'owned') {
      throw new Error('QuizAttempt must be in owned status')
    }

    // Validation: Check teacher matches
    if (quizAttempt.quizTeacher !== quizToken.teacher) {
      throw new Error('QuizAttempt teacher must match quiz token teacher')
    }

    // STEP 1: Burn the quiz token (set amount to 0)
    quizToken.burn()

    // STEP 2: Mark attempt as redeemed (enables submitCommitment)
    quizAttempt.markAsRedeemed()

    // Return both modified contracts
    return [quizToken, quizAttempt]
  }
}
