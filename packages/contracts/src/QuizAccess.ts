// TypeScript version for local development (not used for deployment)
// Bitcoin Computer requires JavaScript without imports
// For deployment, use the JS version or strip types
// @ts-expect-error - Bitcoin Computer library type definitions issue
import { Contract } from '@bitcoin-computer/lib'

// Type for Quiz token contract
interface Quiz extends Contract {
  _owners: string[]
  _satoshis: bigint
  amount: bigint
  symbol: string
  teacher: string
  entryFee: bigint
  transfer(recipient: string, amount: bigint): Quiz
}

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

/**
 * QuizAccess - Atomic Quiz Purchase (EXEC Pattern)
 *
 * Enables atomic swap:
 * - Teacher gives Quiz fungible token (1 quiz token)
 * - Student pays entry fee (Payment contract)
 *
 * Uses SIGHASH_SINGLE | SIGHASH_ANYONECANPAY for partial signing:
 * 1. Teacher creates Quiz token and mock Payment
 * 2. Teacher partially signs with their input (quiz token)
 * 3. Student creates real Payment
 * 4. Student updates transaction with real payment UTXO
 * 5. Student funds, signs, and broadcasts
 * 6. Atomic execution: both transfers happen or neither happens
 *
 * Result:
 * - Student receives 1 Quiz token
 * - Teacher receives entry fee Payment
 */
export class QuizAccess extends Contract {
  /**
   * Execute atomic quiz purchase
   *
   * @param quizToken - Teacher's Quiz fungible token
   * @param entryFeePayment - Student's entry fee Payment
   * @returns [Payment to teacher, Quiz token to student]
   */
  static exec(
    quizToken: Quiz,
    entryFeePayment: Payment
  ): [Payment, Quiz] {
    const [teacher] = quizToken._owners
    const [student] = entryFeePayment._owners

    // Validation: Check quiz token has available balance
    if (quizToken.amount < 1n) {
      throw new Error('No available quiz tokens')
    }

    // Validation: Check payment is addressed to teacher
    if (entryFeePayment.recipient !== teacher) {
      throw new Error('Entry fee must be paid to teacher')
    }

    // Validation: Check payment purpose
    if (entryFeePayment.purpose !== 'Entry Fee') {
      throw new Error('Payment must be for entry fee')
    }

    // Validation: Check payment amount matches quiz entry fee
    if (entryFeePayment.amount !== quizToken.entryFee) {
      throw new Error('Payment amount must match quiz entry fee')
    }

    // Atomic execution (following TBC20 Sale.exec pattern):
    // 1. Transfer entry fee payment to teacher
    entryFeePayment.transfer(teacher)

    // 2. Split quiz token using TBC20 pattern
    // This is the CRITICAL part - quizToken.transfer() returns NEW UTXO
    // and modifies the original quizToken's amount
    const studentQuiz = quizToken.transfer(student, 1n)

    // Return both modified contracts
    // entryFeePayment: now owned by teacher
    // studentQuiz: new UTXO with 1 quiz token, owned by student
    return [entryFeePayment, studentQuiz]
  }
}
