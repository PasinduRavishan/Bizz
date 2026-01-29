// TypeScript version for local development (not used for deployment)
// Bitcoin Computer requires JavaScript without imports
// For deployment, use the JS version or strip types
// @ts-expect-error - Bitcoin Computer library type definitions issue
import { Contract } from '@bitcoin-computer/lib'

// Type for Payment contract
interface Payment extends Contract {
  _owners: string[]
  _satoshis: bigint
  recipient: string
  amount: bigint
  purpose: string
  reference: string
  status: string
  transfer(to: string): void
}

// Type for AnswerProof contract
interface AnswerProof extends Contract {
  _owners: string[]
  student: string
  quizRef: string
  attemptRef: string
  answers: string[]
  score: number
  passed: boolean
  transfer(to: string): void
}

// Type for QuizAttempt contract
interface QuizAttempt extends Contract {
  _id: string
  _owners: string[]
  student: string
  quizTeacher: string
  status: string
  passed: boolean | null
  claimedAt: number | null
  claimPrize(): void
}

export class PrizeSwap extends Contract {
  /**
   * Atomic swap: Student gives answer proof and receives prize payment
   *
   * NOTE: Entry fees already collected in Phase 1 (AttemptAccess.exec)
   * This swap exchanges prize for answer proof only
   *
   * @param prizePayment - Payment contract from teacher (prize amount)
   * @param answerProof - AnswerProof contract from student (their answers)
   * @param attempt - QuizAttempt contract
   * @returns [prizePayment, answerProof, attempt] with updated ownership
   */
  static swap(
    prizePayment: Payment,
    answerProof: AnswerProof,
    attempt: QuizAttempt
  ): [Payment, AnswerProof, QuizAttempt] {
    // Get current owners
    const [student] = attempt._owners
    const [proofOwner] = answerProof._owners

    // Verification 1: Prize payment recipient matches attempt owner
    if (student !== prizePayment.recipient) {
      throw new Error('Prize payment must be addressed to attempt owner')
    }

    // Verification 2: Answer proof is owned by the student
    if (proofOwner !== student) {
      throw new Error('Answer proof must be owned by student')
    }

    // Verification 3: Answer proof matches the attempt
    if (answerProof.attemptRef !== attempt._id) {
      throw new Error('Answer proof must match the attempt')
    }

    // Verification 4: Attempt is in verified status (graded)
    if (attempt.status !== 'verified') {
      throw new Error('Attempt must be verified before claiming prize')
    }

    // Verification 5: Student passed the quiz
    if (!attempt.passed) {
      throw new Error('Only passing attempts can claim prizes')
    }

    // Verification 6: Answer proof shows student passed
    if (!answerProof.passed) {
      throw new Error('Answer proof must show student passed')
    }

    // Get teacher from attempt
    const teacher = attempt.quizTeacher

    // Atomic swap: Exchange ownership using transfer() methods
    prizePayment.transfer(student)    // Student receives prize
    answerProof.transfer(teacher)     // Teacher receives answer proof

    // Mark attempt as claimed using its method
    attempt.claimPrize()

    // Return all three objects with updated state
    return [prizePayment, answerProof, attempt]
  }
}
