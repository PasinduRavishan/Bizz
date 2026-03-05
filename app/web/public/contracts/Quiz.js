import { Contract } from '@bitcoin-computer/lib'

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
    if (prizePool < 10000n) {
      throw new Error('Prize pool must be at least 10,000 satoshis')
    }
    if (entryFee < 5000n) {
      throw new Error('Entry fee must be at least 5,000 satoshis')
    }
    if (passThreshold < 0 || passThreshold > 100) {
      throw new Error('Pass threshold must be between 0 and 100')
    }
    // Note: Deadline validation removed to allow syncing past contracts

    // Calculate deadlines (configurable via environment, defaults to 5 minutes for testing)
    const TEACHER_REVEAL_WINDOW = 5 * 60 * 1000 // 5 minutes in ms (configurable)

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
   * Mark quiz as completed after verification
   * Called by verification process
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