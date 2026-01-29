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
    if (!student) throw new Error('Student public key required')
    if (!quizRef) throw new Error('Quiz reference required')
    if (!attemptRef) throw new Error('Attempt reference required')
    if (!Array.isArray(answers) || answers.length === 0) {
      throw new Error('Answers must be a non-empty array')
    }
    if (score < 0 || score > 100) {
      throw new Error('Score must be between 0 and 100')
    }

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
