// TypeScript version for local development (not used for deployment)
// Bitcoin Computer requires JavaScript without imports
// For deployment, use the JS version or strip types

// @ts-expect-error - Bitcoin Computer library type definitions issue
import { Contract } from '@bitcoin-computer/lib'

export class Payment extends Contract {
  // Contract base properties
  _id!: string
  _rev!: string
  _owners!: string[]
  _satoshis!: bigint

  // Payment properties
  recipient!: string
  amount!: bigint
  purpose!: string
  reference!: string
  status!: string
  createdAt!: number
  claimedAt!: number | null

  constructor(recipient: string, amount: bigint, purpose: string, reference: string) {
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

  claim(): void {
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

export class Quiz extends Contract {
  // Contract base properties
  _id!: string
  _rev!: string
  _owners!: string[]
  _satoshis!: bigint

  // Quiz properties
  teacher!: string
  questionHashIPFS!: string
  answerHashes!: string[]
  questionCount!: number
  entryFee!: bigint
  prizePool!: bigint
  passThreshold!: number
  platformFee!: number
  deadline!: number
  teacherRevealDeadline!: number
  distributionDeadline!: number
  distributedAt!: number
  status!: string
  revealedAnswers!: string[] | null
  salt!: string | null
  winners!: Array<{
    student: string
    prizeAmount: string
    paymentRev: string
  }>
  createdAt!: number
  version!: string

  constructor(
    teacher: string,
    questionHashIPFS: string,
    answerHashes: string[],
    prizePool: bigint,
    entryFee: bigint,
    passThreshold: number,
    deadline: number,
    teacherRevealDeadline: number | null = null
  ) {
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
    // Note: Don't validate deadline against Date.now() in constructor
    // because when syncing old contracts, the deadline will be in the past
    // Validation happens in methods that use the deadline

    // If not provided, default to 48 hours after deadline
    const TEACHER_REVEAL_WINDOW = 48 * 3600 * 1000
    const finalTeacherRevealDeadline = teacherRevealDeadline || (deadline + TEACHER_REVEAL_WINDOW)

    super({
      _owners: [teacher],
      _satoshis: BigInt(546),
      teacher,
      questionHashIPFS,
      answerHashes,
      questionCount: answerHashes.length,
      entryFee,
      prizePool,
      passThreshold,
      platformFee: 0.02,
      deadline,
      teacherRevealDeadline: finalTeacherRevealDeadline,
      distributionDeadline: 0,
      status: 'active',
      revealedAnswers: null,
      salt: null,
      winners: [],
      createdAt: Date.now(),
      version: '1.0.0'
    })
  }

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
      isActive: this.status === 'active' && Date.now() < this.deadline,
      canReveal: Date.now() >= this.deadline && Date.now() < this.teacherRevealDeadline,
      isExpired: Date.now() > this.teacherRevealDeadline && this.status === 'active'
    }
  }

  revealAnswers(answers: string[], salt: string): void {
    if (!this._owners.includes(this.teacher)) {
      throw new Error('Only teacher can reveal answers')
    }
    if (this.status !== 'active') {
      throw new Error('Quiz is not in active status')
    }
    // Note: Deadline checks commented out to avoid issues during blockchain replay
    // In production, these should be enforced at the application layer before calling
    // if (Date.now() < this.deadline) {
    //   throw new Error('Quiz is still active')
    // }
    // if (Date.now() > this.teacherRevealDeadline) {
    //   throw new Error('Teacher reveal deadline has passed')
    // }
    if (answers.length !== this.answerHashes.length) {
      throw new Error('Answer count does not match')
    }

    this.revealedAnswers = answers
    this.salt = salt
    this.status = 'revealed'
    this.distributionDeadline = Date.now() + (24 * 60 * 60 * 1000)
  }

  distributePrizes(winners: Array<{ student: string }> = []): string[] {
    if (this.status !== 'revealed') {
      throw new Error('Quiz must be revealed first')
    }
    if (!this._owners.includes(this.teacher)) {
      throw new Error('Only teacher can distribute prizes')
    }
    // Note: Distribution deadline check removed to avoid replay issues
    // if (Date.now() > this.distributionDeadline) {
    //   throw new Error('Distribution deadline passed')
    // }
    if (!Array.isArray(winners) || winners.length === 0) {
      this.status = 'completed'
      this.distributedAt = Date.now()
      return []
    }

    const payments: string[] = []
    let totalDistributed = BigInt(0)
    const prizePerWinner = this.prizePool / BigInt(winners.length)

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

    this.winners = winners.map((w, i) => ({
      ...w,
      prizeAmount: prizePerWinner.toString(),
      paymentRev: payments[i]
    }))
    this.status = 'completed'
    this.distributedAt = Date.now()

    return payments
  }

  markDistributionComplete(): void {
    if (this.status !== 'distributing') {
      throw new Error('Quiz must be in distributing status')
    }
    this.status = 'completed'
  }

  complete(winners: Array<{ student: string; prizeAmount: string; paymentRev: string }>): void {
    if (this.status !== 'revealed') {
      throw new Error('Quiz must be revealed first')
    }
    this.winners = winners
    this.status = 'completed'
  }

  triggerRefund(): void {
    if (this.status !== 'active') {
      throw new Error('Quiz is not in active status')
    }
    if (Date.now() <= this.teacherRevealDeadline) {
      throw new Error('Teacher still has time to reveal')
    }
    this.status = 'refunded'
  }

  markAbandoned(): void {
    const now = Date.now()
    if (this.status === 'active' && now > this.teacherRevealDeadline) {
      this.status = 'abandoned'
      return
    }
    if (this.status === 'revealed' && now > this.distributionDeadline) {
      this.status = 'abandoned'
      return
    }
    throw new Error('Cannot mark as abandoned yet')
  }
}
