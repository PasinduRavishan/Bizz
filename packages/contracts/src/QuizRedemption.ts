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


export class QuizRedemption extends Contract {

  static redeem(
    quizToken: Quiz,
    quizAttempt: QuizAttempt
  ): [Quiz, QuizAttempt] {
    // STEP 1: Burn the quiz token (set amount to 0)
    quizToken.burn()

    // STEP 2: Mark attempt as redeemed (enables submitCommitment)
    quizAttempt.markAsRedeemed()

    // Return both modified contracts
    return [quizToken, quizAttempt]
  }
}

// ============================================================================
// HELPER CLASS
// Pattern: Bitcoin Computer monorepo - Helper class with computer instance
// ============================================================================

export class QuizRedemptionHelper {
  computer: any
  mod?: string

  constructor(computer: any, mod?: string) {
    this.computer = computer
    this.mod = mod
  }

  async deploy() {
    this.mod = await this.computer.deploy(`export ${QuizRedemption}`)
    return this.mod
  }

  // Validation function
  validateRedemption(quizToken: any, quizAttempt: any): void {
    const [student] = quizToken._owners

    // Validation: Student must own the quiz token
    if (!student) {
      throw new Error('Quiz token must be owned by student')
    }

    // Validation: Must have exactly 1 quiz token
    if (quizToken.amount !== BigInt(1)) {
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
  }

  async redeemQuizToken(quizToken: any, quizAttempt: any) {
    // Validate before redemption
    this.validateRedemption(quizToken, quizAttempt)

    const { tx, effect } = await this.computer.encode({
      exp: `${QuizRedemption} QuizRedemption.redeem(quizToken, quizAttempt)`,
      env: {
        quizToken: quizToken._rev,
        quizAttempt: quizAttempt._rev
      },
      mod: this.mod
    })

    return { tx, effect }
  }
}
