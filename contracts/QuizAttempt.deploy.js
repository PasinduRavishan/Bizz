// Deployment-ready QuizAttempt contract (no imports, Contract is available in Bitcoin Computer context)

export class QuizAttempt extends Contract {
  constructor(student, quizRef, answerCommitment, entryFee) {
    if (!student) throw new Error('Student public key required')
    if (!quizRef) throw new Error('Quiz reference required')
    if (!answerCommitment) throw new Error('Answer commitment required')
    if (entryFee < BigInt(5000)) {
      throw new Error('Entry fee must be at least 5,000 satoshis')
    }

    super({
      _owners: [student],
      _satoshis: entryFee,
      student,
      quizRef,
      answerCommitment,
      revealedAnswers: null,
      nonce: null,
      score: null,
      passed: null,
      status: 'committed',
      submitTimestamp: Date.now(),
      revealTimestamp: null,
      version: '1.0.0'
    })
  }

  reveal(answers, nonce) {
    if (this.status !== 'committed') {
      throw new Error('Attempt already revealed or verified')
    }
    if (!Array.isArray(answers) || answers.length === 0) {
      throw new Error('Answers must be a non-empty array')
    }
    if (!nonce) {
      throw new Error('Nonce is required')
    }

    this.revealedAnswers = answers
    this.nonce = nonce
    this.status = 'revealed'
    this.revealTimestamp = Date.now()
  }

  verify(score, passed) {
    if (this.status !== 'revealed') {
      throw new Error('Must reveal answers first')
    }

    this.score = score
    this.passed = passed
    this.status = 'verified'
  }

  fail() {
    this.status = 'failed'
    this.passed = false
  }

  claimRefund(quiz) {
    // Student can claim refund if:
    // 1. Quiz is abandoned (teacher never revealed or never distributed)
    // 2. They haven't claimed refund yet
    // 3. Caller is the student who owns this attempt
    if (quiz.status !== 'abandoned') {
      throw new Error('Cannot claim refund: quiz not abandoned')
    }
    if (this.status === 'refunded') {
      throw new Error('Refund already claimed')
    }
    if (!this._owners.includes(this.student)) {
      throw new Error('Only the student can claim refund')
    }

    // Mark as refunded and reduce to dust
    // The actual refund amount is withdrawn by the student wallet
    this.status = 'refunded'
    this._satoshis = BigInt(546) // Reduce to dust, rest goes to student
  }

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
      hasRevealed: this.status !== 'committed',
      revealedAnswers: this.revealedAnswers
    }
  }
}
