import { Contract } from '@bitcoin-computer/lib'
import crypto from 'crypto'

/**
 * QuizAttempt Smart Contract
 * 
 * Represents a student's attempt at a quiz
 * Uses commit-reveal scheme for security:
 * - Phase 1: Student submits hash of answers (before deadline)
 * - Phase 2: Student reveals actual answers (after deadline)
 */
class QuizAttempt extends Contract {
  /**
   * Constructor - Student submits their attempt
   * 
   * @param {string} student - Student's public key
   * @param {string} quizRef - Reference to Quiz contract
   * @param {string} answerCommitment - SHA256 hash of (answers + nonce)
   * @param {bigint} entryFee - Amount paid by student
   */
  constructor(student, quizRef, answerCommitment, entryFee) {
    // Validate inputs
    if (!student) throw new Error('Student public key required')
    if (!quizRef) throw new Error('Quiz reference required')
    if (!answerCommitment) throw new Error('Answer commitment required')
    if (entryFee < 5000n) {
      throw new Error('Entry fee must be at least 5,000 satoshis')
    }

    // Initialize contract
    super({
      _owners: [student],              // Student owns this attempt
      _satoshis: entryFee,             // Entry fee locked in contract
      
      // Attempt data
      student,
      quizRef,
      answerCommitment,                // Hash of answers (Phase 1)
      
      // Will be filled in Phase 2
      revealedAnswers: null,
      nonce: null,
      
      // Will be filled after verification
      score: null,
      passed: null,
      
      // State
      status: 'committed',             // committed | revealed | verified | failed
      submitTimestamp: Date.now(),
      revealTimestamp: null,
      
      // Metadata
      version: '1.0.0'
    })
  }

  /**
   * Phase 2: Student reveals their answers
   * Must be called after quiz deadline but before student reveal deadline
   * 
   * @param {string[]} answers - Actual answers student selected
   * @param {string} nonce - Random nonce used in commitment
   */
  reveal(answers, nonce) {
    // Can only reveal once
    if (this.status !== 'committed') {
      throw new Error('Attempt already revealed or verified')
    }

    // Validate commitment matches
    const commitment = this._hashCommitment(answers, nonce)
    if (commitment !== this.answerCommitment) {
      throw new Error('Commitment verification failed - answers do not match hash')
    }

    // Store revealed data
    this.revealedAnswers = answers
    this.nonce = nonce
    this.status = 'revealed'
    this.revealTimestamp = Date.now()
  }

  /**
   * Helper: Hash answers + nonce to create commitment
   * 
   * @private
   */
  _hashCommitment(answers, nonce) {
    
    const data = JSON.stringify(answers) + nonce
    return crypto.createHash('sha256').update(data).digest('hex')
  }

  /**
   * Mark as verified with score
   * Called by verification process
   * 
   * @param {number} score - Percentage score (0-100)
   * @param {boolean} passed - Whether student passed
   */
  verify(score, passed) {
    if (this.status !== 'revealed') {
      throw new Error('Must reveal answers first')
    }

    this.score = score
    this.passed = passed
    this.status = 'verified'
  }

  /**
   * Mark as failed (didn't reveal in time)
   */
  fail() {
    this.status = 'failed'
    this.passed = false
  }

  /**
   * Get attempt info
   */
  getInfo() {
    return {
      attemptId: this._id,
      student: this.student,
      quizRef: this.quizRef,
      status: this.status,
      submitTimestamp: this.submitTimestamp,
      revealTimestamp: this.revealTimestamp,
      score: this.score,
      passed: this.passed,
      hasRevealed: this.status !== 'committed'
    }
  }
}

export default QuizAttempt