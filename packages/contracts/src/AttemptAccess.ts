// @ts-expect-error - Bitcoin Computer library type definitions issue
import { Contract } from '@bitcoin-computer/lib'

// Type definitions for validation
interface Payment extends Contract {
  _owners: string[]
  _satoshis: bigint
  recipient: string
  transfer(to: string): void
}

interface QuizAttempt extends Contract {
  _owners: string[]
  answerCommitment: string
  entryFee: bigint
  quizTeacher: string
  status: string
  transfer(newOwner: string): void
}

export class AttemptAccess extends Contract {

  static exec(
    attempt: QuizAttempt,
    entryFeePayment: Payment
  ): [Payment, QuizAttempt] {
    // Get current owners
    const [teacher] = attempt._owners
    const [student] = entryFeePayment._owners


    if (attempt.answerCommitment !== '') {
      throw new Error('Attempt already has answers committed')
    }

    if (attempt.status !== 'available') {
      throw new Error('Attempt not available for purchase')
    }

    if (entryFeePayment._satoshis < attempt.entryFee) {
      throw new Error('Insufficient entry fee payment')
    }

    if (entryFeePayment.recipient !== teacher) {
      throw new Error('Entry fee must be paid to teacher')
    }

    // Exchange ownership
    attempt.transfer(student)           // Student now owns attempt
    entryFeePayment.transfer(teacher)   // Teacher now owns entry fee

    // Return order matters for UTXO outputs
    return [entryFeePayment, attempt]
  }
}
