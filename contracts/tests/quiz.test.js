/**
 * Unit Tests for Quiz Contract
 */

import Quiz from '../Quiz.js'
import { Computer } from '@bitcoin-computer/lib'
import crypto from 'crypto'

describe('Quiz Contract', () => {
  let computer
  let teacherPubKey

  beforeAll(async () => {
    computer = new Computer({
      chain: 'LTC',
      network: 'testnet'
    })
    await computer.faucet(0.01e8)
    teacherPubKey = computer.getPublicKey()
  })

  test('should create quiz with valid parameters', async () => {
    const answerHashes = ['hash1', 'hash2', 'hash3']
    
    const quiz = await computer.new(Quiz, [
      teacherPubKey,
      'QmTest',
      answerHashes,
      50000n,
      5000n,
      70,
      Date.now() + 3600000
    ])

    expect(quiz.teacher).toBe(teacherPubKey)
    expect(quiz.status).toBe('active')
    expect(quiz.questionCount).toBe(3)
  })

  test('should reject quiz with low prize pool', async () => {
    const answerHashes = ['hash1', 'hash2']
    
    await expect(
      computer.new(Quiz, [
        teacherPubKey,
        'QmTest',
        answerHashes,
        1000n, // Too low!
        5000n,
        70,
        Date.now() + 3600000
      ])
    ).rejects.toThrow('Prize pool must be at least')
  })

  test('should reject quiz with past deadline', async () => {
    const answerHashes = ['hash1', 'hash2']
    
    await expect(
      computer.new(Quiz, [
        teacherPubKey,
        'QmTest',
        answerHashes,
        50000n,
        5000n,
        70,
        Date.now() - 1000 // In the past!
      ])
    ).rejects.toThrow('Deadline must be in the future')
  })
})