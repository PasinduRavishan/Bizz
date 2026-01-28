// Deployment-ready PrizeSwap contract (no imports, Contract is available in Bitcoin Computer context)
// Based on Bitcoin Computer Sale/Swap pattern for atomic prize claiming with entry fee payment

export class PrizeSwap extends Contract {
  /**
   * Atomic swap: Student pays entry fee and receives prize payment
   *
   * @param {Object} prizePayment - Payment contract from teacher (prize amount)
   * @param {Object} entryFeePayment - Payment contract from student (entry fee)
   * @param {Object} attempt - QuizAttempt contract
   * @returns {Array} [prizePayment, entryFeePayment, attempt] with updated ownership
   */
  static swap(prizePayment, entryFeePayment, attempt) {
    // Get current owners
    const [student] = attempt._owners
    const [entryFeePayer] = entryFeePayment._owners

    // Verification 1: Prize payment recipient matches attempt owner
    if (student !== prizePayment.recipient) {
      throw new Error('Prize payment must be addressed to attempt owner')
    }

    // Verification 2: Entry fee payment is from the student (owner creates it)
    if (entryFeePayer !== student) {
      throw new Error('Entry fee must be paid by student')
    }

    // Verification 3: Attempt is in verified status (graded)
    if (attempt.status !== 'verified') {
      throw new Error('Attempt must be verified before claiming prize')
    }

    // Verification 4: Student passed the quiz
    if (!attempt.passed) {
      throw new Error('Only passing attempts can claim prizes')
    }

    // Verification 5: Prize not already claimed
    if (attempt.status === 'prize_claimed') {
      throw new Error('Prize already claimed')
    }

    // Get teacher from attempt
    const teacher = attempt.quizTeacher

    // Atomic swap: Exchange ownership using transfer() methods
    prizePayment.transfer(student)         // Student receives prize
    entryFeePayment.transfer(teacher)      // Teacher receives entry fee

    // Mark attempt as claimed using its method
    attempt.claimPrize()

    // Return all three objects with updated state
    return [prizePayment, entryFeePayment, attempt]
  }
}
