// TypeScript version for local development (not used for deployment)
// Bitcoin Computer requires JavaScript without imports
// For deployment, use the JS version or strip types
// @ts-expect-error - Bitcoin Computer library type definitions issue
import { Contract } from '@bitcoin-computer/lib'

export class QuizAttempt extends Contract {
  // Contract base properties
  _id!: string
  _rev!: string
  _owners!: string[]
  _satoshis!: bigint

  // QuizAttempt properties
  student!: string
  quizRef!: string
  answerCommitment!: string
  quizTeacher!: string
  entryFee!: bigint
  score!: number | null
  passed!: boolean | null
  status!: string  // 'available' | 'owned' | 'committed' | 'verified' | 'prize_claimed' | 'refunded'
  submitTimestamp!: number
  claimedAt!: number | null
  version!: string

  constructor(
    owner: string,           // Initially teacher, then student after exec
    quizRef: string,
    answerCommitment: string,  // Empty at creation, filled after purchase
    entryFee: bigint,
    quizTeacher: string
  ) {
    if (!owner) throw new Error('Owner required')
    if (!quizRef) throw new Error('Quiz reference required')
    // answerCommitment can be empty - filled after purchase
    if (entryFee < BigInt(5000)) {
      throw new Error('Entry fee must be at least 5,000 satoshis')
    }
    if (!quizTeacher) throw new Error('Quiz teacher public key required')

    super({
      _owners: [owner],
      _satoshis: BigInt(546),  // Dust only
      student: owner,          // Will be updated after transfer
      quizRef,
      answerCommitment,
      quizTeacher,
      entryFee,
      score: null,
      passed: null,
      status: 'available',  // NEW: Initial status for teacher-created attempts
      submitTimestamp: Date.now(),
      claimedAt: null,
      version: '2.0.0'  // Version bump for new flow
    })
  }

  // NEW: Transfer ownership (called by AttemptAccess.exec)
  transfer(newOwner: string): void {
    this._owners = [newOwner]
    this.student = newOwner
    this.status = 'owned'
  }

  // NEW: Student submits answers after purchasing attempt
  submitCommitment(commitment: string): void {
    if (this.status !== 'owned') {
      throw new Error('Must own attempt before submitting answers')
    }
    if (!commitment) {
      throw new Error('Commitment required')
    }

    this.answerCommitment = commitment
    this.status = 'committed'
    this.submitTimestamp = Date.now()
  }

  // REMOVED: reveal() method (no student reveal phase)

  // UPDATED: verify() now works from commitment only
  verify(score: number, passed: boolean): void {
    if (this.status !== 'committed') {
      throw new Error('Attempt must be committed before verification')
    }

    this.score = score
    this.passed = passed
    this.status = 'verified'
  }

  fail(): void {
    this.status = 'failed'
    this.passed = false
  }

  claimPrize(): void {
    if (this.status !== 'verified') {
      throw new Error('Attempt must be verified before claiming prize')
    }
    if (!this.passed) {
      throw new Error('Only passing attempts can claim prizes')
    }
    this.status = 'prize_claimed'
    this.claimedAt = Date.now()
  }

  claimRefund(quiz: { status: string }): void {
    if (quiz.status !== 'abandoned') {
      throw new Error('Cannot claim refund: quiz not abandoned')
    }
    if (this.status === 'refunded') {
      throw new Error('Refund already claimed')
    }
    if (!this._owners.includes(this.student)) {
      throw new Error('Only the student can claim refund')
    }

    this.status = 'refunded'
    this._satoshis = BigInt(546)
  }

  getInfo() {
    return {
      attemptId: this._id,
      student: this.student,
      quizRef: this.quizRef,
      status: this.status,
      submitTimestamp: this.submitTimestamp,
      score: this.score,
      passed: this.passed,
      answerCommitment: this.answerCommitment
    }
  }
}
