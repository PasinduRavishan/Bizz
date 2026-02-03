// TypeScript version for local development (not used for deployment)
// Bitcoin Computer requires JavaScript without imports
// For deployment, use the JS version or strip types
// @ts-expect-error - Bitcoin Computer library type definitions issue
import { Contract } from '@bitcoin-computer/lib'

// Type for SeatToken contract
interface SeatToken extends Contract {
  _owners: string[]
  _satoshis: bigint
  amount: bigint
  symbol: string
  quizRef: string
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


export class SeatRedemption extends Contract {

  static redeem(
    seatToken: SeatToken,
    quizAttempt: QuizAttempt
  ): [SeatToken, QuizAttempt] {
    const [student] = seatToken._owners

    // Validation: Student must own the seat token
    if (!student) {
      throw new Error('Seat token must be owned by student')
    }

    // Validation: Must have exactly 1 seat
    if (seatToken.amount !== 1n) {
      throw new Error('Must have exactly 1 seat token to redeem')
    }

    // Validation: Check symbol
    if (seatToken.symbol !== 'SEAT') {
      throw new Error('Invalid seat token symbol')
    }

    // Validation: QuizAttempt must be owned by same student
    const [attemptOwner] = quizAttempt._owners
    if (attemptOwner !== student) {
      throw new Error('QuizAttempt must be owned by seat token owner')
    }

    // Validation: QuizAttempt must be for the same quiz as the seat
    if (quizAttempt.quizRef !== seatToken.quizRef) {
      throw new Error('QuizAttempt must be for the same quiz as the seat')
    }

    // Validation: QuizAttempt must be in 'owned' status (not yet used)
    if (quizAttempt.status !== 'owned') {
      throw new Error('QuizAttempt must be in owned status')
    }


    seatToken.burn()


    quizAttempt.markAsRedeemed()


    return [seatToken, quizAttempt]
  }
}
