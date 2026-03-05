// @ts-expect-error - Bitcoin Computer library type definitions issue
import { Contract } from '@bitcoin-computer/lib'

export class AnswerProof extends Contract {
  // Contract base properties
  _id!: string
  _rev!: string
  _owners!: string[]
  _satoshis!: bigint

  // AnswerProof properties
  student!: string
  quizRef!: string
  attemptRef!: string
  answers!: string[]
  score!: number
  passed!: boolean
  createdAt!: number

  constructor(
    student: string,
    quizRef: string,
    attemptRef: string,
    answers: string[],
    score: number,
    passed: boolean
  ) {
    super({
      _owners: [student],
      _satoshis: BigInt(546),  // Dust amount
      student,
      quizRef,
      attemptRef,
      answers,
      score,
      passed,
      createdAt: Date.now()
    })
  }

  transfer(to: string): void {
    this._owners = [to]
  }

  getInfo() {
    return {
      proofId: this._id,
      student: this.student,
      quizRef: this.quizRef,
      attemptRef: this.attemptRef,
      answers: this.answers,
      score: this.score,
      passed: this.passed,
      createdAt: this.createdAt
    }
  }
}

// ============================================================================
// HELPER FUNCTIONS
// Pattern: Bitcoin Computer monorepo - helpers outside class in same file
// ============================================================================

// ============================================================================
// HELPER CLASS
// Pattern: Bitcoin Computer monorepo - Helper class with computer instance
// ============================================================================

export class AnswerProofHelper {
  computer: any
  mod?: string

  constructor(computer: any, mod?: string) {
    this.computer = computer
    this.mod = mod
  }

  async deploy() {
    this.mod = await this.computer.deploy(`export ${AnswerProof}`)
    return this.mod
  }

  // Validation function
  validateProofParams(params: {
    student: string
    quizRef: string
    attemptRef: string
    answers: string[]
    score: number
    passed: boolean
  }): void {
    if (!params.student) throw new Error('Student public key required')
    if (!params.quizRef) throw new Error('Quiz reference required')
    if (!params.attemptRef) throw new Error('Attempt reference required')
    if (!Array.isArray(params.answers) || params.answers.length === 0) {
      throw new Error('Answers must be a non-empty array')
    }
    if (params.score < 0 || params.score > 100) {
      throw new Error('Score must be between 0 and 100')
    }
  }

  async createAnswerProof(params: {
    student: string
    quizRef: string
    attemptRef: string
    answers: string[]
    score: number
    passed: boolean
  }) {
    // Validate before creating
    this.validateProofParams(params)

    const { tx, effect } = await this.computer.encode({
      mod: this.mod,
      exp: `new AnswerProof("${params.student}", "${params.quizRef}", "${params.attemptRef}", ${JSON.stringify(params.answers)}, ${params.score}, ${params.passed})`
    })

    return { tx, effect }
  }
}
