import { Contract } from '@bitcoin-computer/lib'





class Payment extends Contract {
  constructor(recipient, amount, purpose, reference) {
    if (!recipient) throw new Error('Recipient required')
    if (amount < BigInt(546)) throw new Error('Amount must be at least 546 satoshis')
    if (!purpose) throw new Error('Purpose required')

    super({
      _owners: [recipient],
      _satoshis: amount,
      recipient,
      amount,
      purpose,
      reference,
      status: 'unclaimed',
      createdAt: Date.now(),
      claimedAt: null
    })
  }

  claim() {
    if (this.status === 'claimed') {
      throw new Error('Payment already claimed')
    }
    this._satoshis = BigInt(546)
    this.status = 'claimed'
    this.claimedAt = Date.now()
  }

  getInfo() {
    return {
      paymentId: this._id,
      recipient: this.recipient,
      amount: this.amount,
      purpose: this.purpose,
      reference: this.reference,
      status: this.status,
      createdAt: this.createdAt,
      claimedAt: this.claimedAt,
      canClaim: this.status === 'unclaimed'
    }
  }
}


/**
 * Quiz Smart Contract
 * 
 * Represents a quiz created by a teacher with the following features:
 * - Teacher deposits a prize pool
 * - Students pay entry fee to attempt
 * - Answers are hashed for security
 * - Time-based deadlines enforced
 * - Winners split prize pool
 * - Entry fees go to teacher
 * 
 * NOTE: Quiz attempts are stored separately as QuizAttempt contracts.
 * To find attempts for a quiz, query QuizAttempt contracts by quizRef.
 */
class Quiz extends Contract {
  /**
   * Constructor - Creates a new quiz
   * 
   * @param {string} teacher - Teacher's public key
   * @param {string} questionHashIPFS - IPFS hash of questions JSON
   * @param {string[]} answerHashes - Array of hashed correct answers
   * @param {bigint} prizePool - Amount teacher deposits (in satoshis)
   * @param {bigint} entryFee - Cost per student attempt (in satoshis)
   * @param {number} passThreshold - Percentage needed to pass (0-100)
   * @param {number} deadline - Unix timestamp when submissions close
   */
  constructor(
    teacher,
    questionHashIPFS,
    answerHashes,
    prizePool,
    entryFee,
    passThreshold,
    deadline
  ) {
    // Validate inputs
    if (!teacher) throw new Error('Teacher public key required')
    if (!questionHashIPFS) throw new Error('Question hash required')
    if (!Array.isArray(answerHashes) || answerHashes.length === 0) {
      throw new Error('Answer hashes must be a non-empty array')
    }
    if (prizePool < BigInt(10000)) {
      throw new Error('Prize pool must be at least 10,000 satoshis')
    }
    if (entryFee < BigInt(5000)) {
      throw new Error('Entry fee must be at least 5,000 satoshis')
    }
    if (passThreshold < 0 || passThreshold > 100) {
      throw new Error('Pass threshold must be between 0 and 100')
    }
    if (deadline <= Date.now()) {
      throw new Error('Deadline must be in the future')
    }

    // Calculate deadlines
    const TEACHER_REVEAL_WINDOW = 48 * 3600 * 1000 // 48 hours in ms

    // Initialize contract state
    super({
      _owners: [teacher],              // Teacher owns this contract
      _satoshis: prizePool,            // Lock prize pool in contract
      
      // Quiz metadata
      teacher,
      questionHashIPFS,
      answerHashes,
      questionCount: answerHashes.length,
      
      // Economic parameters
      entryFee,
      prizePool,
      passThreshold,
      platformFee: 0.02,               // 2% platform fee
      
      // Timing
      deadline,
      teacherRevealDeadline: deadline + TEACHER_REVEAL_WINDOW,
      
      // State tracking
      status: 'active',                // active | revealed | completed | refunded
      revealedAnswers: null,           // Will be filled when teacher reveals
      salt: null,                      // Will be filled when teacher reveals
      winners: [],                     // Will be filled after verification
      
      // Metadata
      createdAt: Date.now(),
      version: '1.0.0'
    })
  }

  /**
   * Get quiz information (callable by anyone)
   * Returns public quiz data without revealing answers
   */
  getInfo() {
    return {
      quizId: this._id,
      quizRev: this._rev,
      teacher: this.teacher,
      questionHashIPFS: this.questionHashIPFS,
      questionCount: this.questionCount,
      entryFee: this.entryFee,
      prizePool: this._satoshis,
      passThreshold: this.passThreshold,
      deadline: this.deadline,
      teacherRevealDeadline: this.teacherRevealDeadline,
      status: this.status,
      createdAt: this.createdAt,
      
      // Computed fields
      isActive: this.status === 'active' && Date.now() < this.deadline,
      canReveal: Date.now() >= this.deadline && Date.now() < this.teacherRevealDeadline,
      isExpired: Date.now() > this.teacherRevealDeadline && this.status === 'active'
    }
  }

  /**
   * Teacher reveals correct answers
   * Must be called after student reveal window but before teacher reveal deadline
   * 
   * @param {string[]} answers - Correct answers
   * @param {string} salt - Salt used in hashing
   * @returns {Quiz} Returns this for chaining
   */
  revealAnswers(answers, salt) {
    // Only teacher can reveal
    if (!this._owners.includes(this.teacher)) {
      throw new Error('Only teacher can reveal answers')
    }

    // Check timing
    if (Date.now() < this.deadline) {
      throw new Error('Quiz is still active')
    }
    if (Date.now() > this.teacherRevealDeadline) {
      throw new Error('Teacher reveal deadline has passed')
    }

    if (this.status !== 'active') {
      throw new Error('Quiz is not in active status')
    }

    // Validate answers match count
    if (answers.length !== this.answerHashes.length) {
      throw new Error('Answer count does not match')
    }

    // Store revealed answers
    this.revealedAnswers = answers
    this.salt = salt
    this.status = 'revealed'

    return undefined
    
    
  }

  /**
   * Distribute prizes to winners
   * Creates Payment contracts for each winner
   * Called by teacher after verification
   * 
   * @param {Array} winners - Array of {student: string, amount: bigint}
   * @returns {Array} Array of Payment contract revs
   */
  // async distributePrizes(winners) {
  //   if (this.status !== 'revealed') {
  //     throw new Error('Quiz must be revealed first')
  //   }

  //   // Only teacher can distribute
  //   if (!this._owners.includes(this.teacher)) {
  //     throw new Error('Only teacher can distribute prizes')
  //   }

  //   if (!Array.isArray(winners) || winners.length === 0) {
  //     // No winners - keep prize pool
  //     this.status = 'completed'
  //     return []
  //   }

  //   // Import Payment contract dynamically
  //   const Payment = (await import('./Payment.js')).default

  //   const payments = []
  //   let totalDistributed = 0n

  //   // Create a Payment contract for each winner
  //   for (const winner of winners) {
  //     const payment = new Payment(
  //       winner.student,
  //       winner.amount,
  //       `Quiz Prize - ${this.questionHashIPFS}`,
  //       this._id
  //     )
  //     payments.push(payment._rev)
  //     totalDistributed += winner.amount
  //   }

  //   // Reduce quiz contract satoshis by distributed amount
  //   this._satoshis = this._satoshis - totalDistributed
  //   this.winners = winners
  //   this.status = 'completed'

  //   return payments
  // }

  async distributePrizes(winners) {
    if (this.status !== 'revealed') {
      throw new Error('Quiz must be revealed first')
    }

    if (!this._owners.includes(this.teacher)) {
      throw new Error('Only teacher can distribute prizes')
    }

    if (!Array.isArray(winners) || winners.length === 0) {
      // No winners - keep prize pool, mark as completed
      this.status = 'completed'
      return []
    }

    // Payment class is in the same module, no need to import
    const payments = []
    let totalDistributed = BigInt(0)

    // Calculate prize per winner
    const totalPrize = this._satoshis - BigInt(546)  // Keep dust for Quiz contract
    const prizePerWinner = totalPrize / BigInt(winners.length)

    // Create a Payment contract for each winner
    // These Payment contracts will be funded from Quiz contract's satoshis
    for (const winner of winners) {
      const payment = new Payment(
        winner.student,
        prizePerWinner,
        `Quiz Prize - ${this.questionHashIPFS}`,
        this._id
      )
      payments.push(payment._rev)
      totalDistributed += prizePerWinner
    }

    // Reduce quiz contract satoshis by distributed amount
    this._satoshis = this._satoshis - totalDistributed
    this.winners = winners.map((w, i) => ({
      ...w,
      prizeAmount: prizePerWinner.toString(),
      paymentRev: payments[i]
    }))
    this.status = 'completed'

    // Return Payment contract revisions
    return payments
  }

  /**
   * Mark distribution as complete after all Payments are created
   */
  markDistributionComplete() {
    if (this.status !== 'distributing') {
      throw new Error('Quiz must be in distributing status')
    }
    this.status = 'completed'
  }




  /**
   * Mark quiz as completed (legacy method for compatibility)
   * 
   * @param {Array} winners - Array of winner objects
   * @returns {Quiz} Returns this for chaining
   */
  complete(winners) {
    if (this.status !== 'revealed') {
      throw new Error('Quiz must be revealed first')
    }

    this.winners = winners
    this.status = 'completed'

    return undefined
  }

  /**
   * Trigger refund if teacher doesn't reveal
   * Can be called by anyone after teacher reveal deadline passes
   * @returns {Quiz} Returns this for chaining
   */
  triggerRefund() {
    if (this.status !== 'active') {
      throw new Error('Quiz is not in active status')
    }
    if (Date.now() <= this.teacherRevealDeadline) {
      throw new Error('Teacher still has time to reveal')
    }

    this.status = 'refunded'

    return undefined
    
    
  }
}

export default Quiz
export { Payment }