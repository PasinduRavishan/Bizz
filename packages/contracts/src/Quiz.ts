import { Token } from './Token'

export class Quiz extends Token {
  // Token properties (inherited from Token base class)
  // amount!: bigint
  // symbol!: string
  // _owners!: string[]

  // Contract base properties (inherited from Token → Contract)
  _id!: string
  _rev!: string
  _satoshis!: bigint

  // Quiz-specific metadata properties
  teacher!: string
  declare originalQuizId: string  // Track original quiz ID across token transfers
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

  /**
   * Constructor - Creates Quiz as fungible token
   *
   * @param to - Token owner (teacher for new quiz, student for transferred tokens)
   * @param initialSupply - Initial supply of quiz tokens (0 for on-demand minting)
   * @param symbol - Token symbol (e.g., "MATH101")
   * @param teacher - Teacher's public key (metadata, not ownership)
   * @param questionHashIPFS - IPFS hash of encrypted questions
   * @param answerHashes - Array of hashed answers
   * @param prizePool - Total prize pool in satoshis
   * @param entryFee - Entry fee per student in satoshis
   * @param passThreshold - Pass percentage (0-100)
   * @param deadline - Quiz deadline timestamp
   * @param teacherRevealDeadline - Deadline for teacher to reveal answers
   * @param originalQuizId - Original quiz ID (for transferred tokens, empty string for new quiz)
   */
  constructor(
    to: string,
    initialSupply: bigint,
    symbol: string,
    teacher: string,
    questionHashIPFS: string,
    answerHashes: string[],
    prizePool: bigint,
    entryFee: bigint,
    passThreshold: number,
    deadline: number,
    teacherRevealDeadline: number | null = null,
    originalQuizId: string = ''
  ) {
    // If not provided, default to 48 hours after deadline
    const TEACHER_REVEAL_WINDOW = 48 * 3600 * 1000
    const finalTeacherRevealDeadline = teacherRevealDeadline || (deadline + TEACHER_REVEAL_WINDOW)

    // Call Token constructor with additional quiz properties
    super(to, initialSupply, symbol, {
      teacher,  // Metadata: who created the quiz
      originalQuizId, // Empty for new quiz, preserved for transfers
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
      version: '2.0.0'
    })
  }


  mint(to: string, amount: bigint): Quiz {
    // Determine originalQuizId: use existing one or this._id for first mint
    const quizId = this.originalQuizId || this._id


    // Pass all quiz metadata INCLUDING originalQuizId and teacher to the new token
    // NOTE: Teacher's balance does NOT decrease - this is minting, not transferring
    return new Quiz(
      to,  // Recipient becomes the new owner
      amount,
      this.symbol,
      this.teacher,  // Preserve original teacher (metadata)
      this.questionHashIPFS,
      this.answerHashes,
      this.prizePool,
      this.entryFee,
      this.passThreshold,
      this.deadline,
      this.teacherRevealDeadline,
      quizId  // Preserve original quiz ID
    )
  }

  transfer(recipient: string, amount: bigint): Quiz {
    // Reduce this UTXO's balance
    this.amount -= amount

    // Determine originalQuizId: use existing one or this._id for first transfer
    const quizId = this.originalQuizId || this._id

    // Create new Quiz token UTXO for recipient (transfer pattern)
    // Pass all quiz metadata INCLUDING originalQuizId and teacher to the new token
    return new Quiz(
      recipient,  // Recipient becomes the new owner
      amount,
      this.symbol,
      this.teacher,  // Preserve original teacher (metadata)
      this.questionHashIPFS,
      this.answerHashes,
      this.prizePool,
      this.entryFee,
      this.passThreshold,
      this.deadline,
      this.teacherRevealDeadline,
      quizId  // Preserve original quiz ID
    )
  }


  burn(): void {
    this.amount = 0n
  }


  revealAnswers(answers: string[], salt: string): void {
    if (!this._owners.includes(this.teacher)) {
      throw new Error('Only teacher can reveal answers')
    }
    if (this.status !== 'active') {
      throw new Error('Quiz is not in active status')
    }
    if (answers.length !== this.answerHashes.length) {
      throw new Error('Answer count does not match')
    }

    this.revealedAnswers = answers
    this.salt = salt
    this.status = 'revealed'
    this.distributionDeadline = Date.now() + (24 * 60 * 60 * 1000)
  }


  distributePrizes(winners: Array<{ student: string; prizeAmount: string; paymentRev: string }> = []): void {
    if (this.status !== 'revealed') {
      throw new Error('Quiz must be revealed first')
    }
    if (!this._owners.includes(this.teacher)) {
      throw new Error('Only teacher can distribute prizes')
    }
    if (!Array.isArray(winners) || winners.length === 0) {
      this.status = 'completed'
      this.distributedAt = Date.now()
      return
    }

    // DEFERRED PAYMENT MODEL:
    // Store winner metadata only - Payment contracts created separately
    // Prize pool stays as metadata, not locked in UTXO
    this.winners = winners
    this.status = 'completed'
    this.distributedAt = Date.now()
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

  getInfo() {
    return {
      quizId: this._id,
      quizRev: this._rev,
      teacher: this.teacher,
      questionHashIPFS: this.questionHashIPFS,
      questionCount: this.questionCount,
      entryFee: this.entryFee,
      prizePool: this.prizePool,
      passThreshold: this.passThreshold,
      deadline: this.deadline,
      teacherRevealDeadline: this.teacherRevealDeadline,
      status: this.status,
      createdAt: this.createdAt,
      // Token info
      tokenAmount: this.amount,
      symbol: this.symbol,
      isActive: this.status === 'active' && Date.now() < this.deadline,
      canReveal: Date.now() >= this.deadline && Date.now() < this.teacherRevealDeadline,
      isExpired: Date.now() > this.teacherRevealDeadline && this.status === 'active'
    }
  }
}

// ============================================================================
// HELPER CLASS
// Pattern: Bitcoin Computer monorepo - Helper class with computer instance
// ============================================================================

export class QuizHelper {
  computer: any
  mod?: string

  constructor(computer: any, mod?: string) {
    this.computer = computer
    this.mod = mod
  }

  async deploy(Token: any, Quiz: any) {
    this.mod = await this.computer.deploy(`export ${Token}\nexport ${Quiz}`)
    return this.mod
  }

  // Validation function
  validateQuizParams(params: {
    teacherPubKey: string
    initialSupply: bigint
    symbol: string
    questionHashIPFS: string
    answerHashes: string[]
    prizePool: bigint
    entryFee: bigint
    passThreshold: number
    deadline: number
    teacherRevealDeadline: number
  }): void {
    if (!params.teacherPubKey) throw new Error('Teacher public key required')
    if (!params.questionHashIPFS) throw new Error('Question hash required')
    if (!Array.isArray(params.answerHashes) || params.answerHashes.length === 0) {
      throw new Error('Answer hashes must be a non-empty array')
    }
    if (params.prizePool < BigInt(10000)) {
      throw new Error('Prize pool must be at least 10,000 satoshis')
    }
    if (params.entryFee < BigInt(5000)) {
      throw new Error('Entry fee must be at least 5,000 satoshis')
    }
    if (params.passThreshold < 0 || params.passThreshold > 100) {
      throw new Error('Pass threshold must be between 0 and 100')
    }
  }

  async createQuiz(params: {
    teacherPubKey: string
    initialSupply: bigint
    symbol: string
    questionHashIPFS: string
    answerHashes: string[]
    prizePool: bigint
    entryFee: bigint
    passThreshold: number
    deadline: number
    teacherRevealDeadline: number
  }) {
    // Validate before creating
    this.validateQuizParams(params)

    const { tx, effect } = await this.computer.encode({
      mod: this.mod,
      exp: `new Quiz("${params.teacherPubKey}", BigInt(${params.initialSupply}), "${params.symbol}", "${params.teacherPubKey}", "${params.questionHashIPFS}", ${JSON.stringify(params.answerHashes)}, BigInt(${params.prizePool}), BigInt(${params.entryFee}), ${params.passThreshold}, ${params.deadline}, ${params.teacherRevealDeadline})`
    })

    return { tx, effect }
  }
}
