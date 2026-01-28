/**
 * COMPREHENSIVE TEST - Multiple Students with Winners and Losers
 * Bitcoin Computer Quiz Platform - Deferred Payment Model
 *
 * Tests the complete flow with multiple students:
 * 1. Quiz Creation (Teacher) - pays only gas
 * 2. Multiple Student Attempts - pays only gas (NO entry fee upfront!)
 * 3. Teacher Reveal & Auto-Scoring
 * 4. Winners: Claim Prize via Atomic Swap (pays entry fee to get prize)
 * 5. Losers: Simple Entry Fee Transfer to Teacher
 *
 * Based on Bitcoin Computer Sale/Swap pattern from monorepo examples
 */

import { describe, it, before } from 'mocha'
import { expect } from 'chai'
import { Computer } from '@bitcoin-computer/lib'
import crypto from 'crypto'
import dotenv from 'dotenv'
import { Quiz, Payment } from '../contracts/Quiz.deploy.js'
import { QuizAttempt } from '../contracts/QuizAttempt.deploy.js'
import { PrizeSwap } from '../contracts/PrizeSwap.deploy.js'

dotenv.config({ path: '.env.local' })

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function hashAnswer(quizId, index, answer, salt) {
  const data = `${quizId}${index}${answer}${salt}`
  return crypto.createHash('sha256').update(data).digest('hex')
}

function hashCommitment(answers, nonce) {
  const data = JSON.stringify(answers) + nonce
  return crypto.createHash('sha256').update(data).digest('hex')
}

function generateSalt() {
  return crypto.randomBytes(32).toString('hex')
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function calculateScore(studentAnswers, correctAnswers) {
  let correct = 0
  for (let i = 0; i < correctAnswers.length; i++) {
    if (studentAnswers[i] === correctAnswers[i]) {
      correct++
    }
  }
  const percentage = Math.floor((correct / correctAnswers.length) * 100)
  return { correct, total: correctAnswers.length, percentage }
}

function didPass(score, threshold, totalQuestions) {
  const requiredCorrect = Math.ceil((threshold / 100) * totalQuestions)
  const actualCorrect = Math.floor((score / 100) * totalQuestions)
  return actualCorrect >= requiredCorrect
}

function displayBalanceChange(label, before, after) {
  const diff = after - before
  const sign = diff >= 0n ? '+' : ''
  console.log(`      ${label}:`)
  console.log(`        Before: ${before.toLocaleString()} sats`)
  console.log(`        After:  ${after.toLocaleString()} sats`)
  console.log(`        Change: ${sign}${diff.toLocaleString()} sats`)
}

async function withRetry(operation, operationName, maxRetries = 5) {
  let lastError = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      const isMempoolConflict = error.message.includes('txn-mempool-conflict')
      const isTooLongChain = error.message.includes('too-long-mempool-chain')

      if (isTooLongChain) {
        if (attempt === maxRetries) {
          throw new Error(`Mempool ancestor limit exceeded: ${error.message}`)
        }
        const delayMs = 15000 * Math.pow(2, attempt - 1)
        console.log(`      ⏳ ${operationName}: Too many ancestors, waiting ${delayMs/1000}s... (${attempt}/${maxRetries})`)
        await sleep(delayMs)
        continue
      }

      if (isMempoolConflict) {
        if (attempt === maxRetries) {
          throw error
        }
        const delayMs = 3000 * Math.pow(2, attempt - 1)
        console.log(`      ⏳ ${operationName}: Mempool conflict, waiting ${delayMs/1000}s... (${attempt}/${maxRetries})`)
        await sleep(delayMs)
        continue
      }

      throw error
    }
  }

  throw lastError
}

// ============================================================================
// TEST SUITE
// ============================================================================

describe('🚀 COMPREHENSIVE TEST - Multiple Students (Winners & Losers)', function() {
  this.timeout(600000) // 10 minutes for blockchain operations

  // Test wallets
  let teacherComputer
  let student1Computer, student2Computer, student3Computer
  let teacherPubKey, student1PubKey, student2PubKey, student3PubKey

  // Contract module specs
  let quizModuleSpec, attemptModuleSpec, swapModuleSpec

  // Test data
  const correctAnswers = ['Paris', '4', 'Blue']
  const salt = generateSalt()
  const entryFee = BigInt(5000)  // 5,000 sats
  const prizePool = BigInt(50000) // 50,000 sats per winner
  const passThreshold = 70 // Need 70% to pass (at least 3/3 correct)

  // Quiz data
  let quizId, quiz
  let answerHashes

  // Student attempts
  let attempt1, attempt2, attempt3
  let student1Data, student2Data, student3Data

  // Prize data
  let prizePayment1

  before(async function() {
    console.log('\n' + '='.repeat(80))
    console.log('  🚀 INITIALIZING COMPREHENSIVE TEST ENVIRONMENT')
    console.log('='.repeat(80))

    console.log('\n  📡 Creating Bitcoin Computer instances...')

    const baseConfig = {
      chain: 'LTC',
      network: 'regtest',
      url: process.env.NEXT_PUBLIC_BITCOIN_COMPUTER_URL || 'https://rltc.node.bitcoincomputer.io'
    }

    teacherComputer = new Computer(baseConfig)
    student1Computer = new Computer(baseConfig)
    student2Computer = new Computer(baseConfig)
    student3Computer = new Computer(baseConfig)

    teacherPubKey = teacherComputer.getPublicKey()
    student1PubKey = student1Computer.getPublicKey()
    student2PubKey = student2Computer.getPublicKey()
    student3PubKey = student3Computer.getPublicKey()

    console.log(`    ✅ Teacher wallet: ${teacherComputer.getAddress()}`)
    console.log(`    ✅ Student 1 wallet: ${student1Computer.getAddress()}`)
    console.log(`    ✅ Student 2 wallet: ${student2Computer.getAddress()}`)
    console.log(`    ✅ Student 3 wallet: ${student3Computer.getAddress()}`)

    console.log('\n  💰 Funding wallets from faucet...')
    await teacherComputer.faucet(10000000) // 10M sats
    await student1Computer.faucet(5000000) // 5M sats each
    await student2Computer.faucet(5000000)
    await student3Computer.faucet(5000000)

    console.log(`    ✅ All wallets funded`)

    console.log('\n  📦 Deploying contract modules...')
    quizModuleSpec = await teacherComputer.deploy(`export ${Quiz}\nexport ${Payment}`)
    attemptModuleSpec = await teacherComputer.deploy(`export ${QuizAttempt}`)
    swapModuleSpec = await teacherComputer.deploy(`export ${PrizeSwap}`)

    console.log(`    ✅ Quiz module deployed`)
    console.log(`    ✅ QuizAttempt module deployed`)
    console.log(`    ✅ PrizeSwap module deployed`)

    console.log('\n  📝 Preparing test data...')
    answerHashes = correctAnswers.map((answer, index) =>
      hashAnswer('quiz-id', index, answer, salt)
    )

    // Student 1: WINNER (100% correct - answers all correctly)
    student1Data = {
      answers: ['Paris', '4', 'Blue'], // All correct
      nonce: generateSalt()
    }
    student1Data.commitment = hashCommitment(student1Data.answers, student1Data.nonce)

    // Student 2: LOSER (33% correct - only 1/3 correct)
    student2Data = {
      answers: ['London', '5', 'Blue'], // Only last one correct
      nonce: generateSalt()
    }
    student2Data.commitment = hashCommitment(student2Data.answers, student2Data.nonce)

    // Student 3: LOSER (0% correct - all wrong)
    student3Data = {
      answers: ['Berlin', '7', 'Red'], // All wrong
      nonce: generateSalt()
    }
    student3Data.commitment = hashCommitment(student3Data.answers, student3Data.nonce)

    console.log(`    ✅ Student 1: Will answer correctly (WINNER)`)
    console.log(`    ✅ Student 2: Will answer 33% correctly (LOSER)`)
    console.log(`    ✅ Student 3: Will answer 0% correctly (LOSER)`)

    console.log('\n' + '='.repeat(80))
    console.log('  ✅ SETUP COMPLETE - Ready to run tests')
    console.log('='.repeat(80) + '\n')
  })

  describe('Phase 1: Quiz Creation', () => {
    it('should create quiz with dust UTXO and metadata prize pool', async function() {
      console.log('\n  🎓 Creating Quiz contract...')

      const deadline = Date.now() + 30000
      const teacherRevealDeadline = deadline + (5 * 60 * 1000)
      const questionHashIPFS = 'QmTest123'

      const { tx, effect } = await withRetry(
        () => teacherComputer.encode({
          mod: quizModuleSpec,
          exp: `new Quiz("${teacherPubKey}", "${questionHashIPFS}", ${JSON.stringify(answerHashes)}, BigInt(${prizePool}), BigInt(${entryFee}), ${passThreshold}, ${deadline}, ${teacherRevealDeadline})`
        }),
        'Encode Quiz creation'
      )

      await withRetry(
        () => teacherComputer.broadcast(tx),
        'Broadcast Quiz creation'
      )

      quiz = effect.res
      quizId = quiz._id

      await sleep(3000)

      console.log(`    ✅ Quiz created: ${quizId}`)
      console.log(`    ✅ Prize pool: ${prizePool.toLocaleString()} sats per winner`)
      console.log(`    ✅ Entry fee: ${entryFee.toLocaleString()} sats`)
      console.log(`    ✅ Pass threshold: ${passThreshold}%`)

      expect(quiz._id).to.be.a('string')
      expect(quiz.status).to.equal('active')
    })
  })

  describe('Phase 2: Student Attempts (3 students, NO upfront payment)', () => {
    it('should allow Student 1 to submit attempt', async function() {
      console.log('\n  👨‍🎓 Student 1 submitting attempt...')

      const { tx: attemptTx, effect: attemptEffect } = await withRetry(
        () => student1Computer.encode({
          mod: attemptModuleSpec,
          exp: `new QuizAttempt("${student1PubKey}", "${quizId}", "${student1Data.commitment}", BigInt(${entryFee}), "${teacherPubKey}")`
        }),
        'Encode student 1 attempt'
      )

      await withRetry(
        () => student1Computer.broadcast(attemptTx),
        'Broadcast student 1 attempt'
      )

      attempt1 = attemptEffect.res
      await sleep(3000)

      console.log(`    ✅ Attempt created: ${attempt1._id}`)
      console.log(`    ✅ Entry fee NOT paid yet! ✨`)

      expect(attempt1.status).to.equal('committed')
    })

    it('should allow Student 2 to submit attempt', async function() {
      console.log('\n  👨‍🎓 Student 2 submitting attempt...')

      const { tx: attemptTx, effect: attemptEffect } = await withRetry(
        () => student2Computer.encode({
          mod: attemptModuleSpec,
          exp: `new QuizAttempt("${student2PubKey}", "${quizId}", "${student2Data.commitment}", BigInt(${entryFee}), "${teacherPubKey}")`
        }),
        'Encode student 2 attempt'
      )

      await withRetry(
        () => student2Computer.broadcast(attemptTx),
        'Broadcast student 2 attempt'
      )

      attempt2 = attemptEffect.res
      await sleep(3000)

      console.log(`    ✅ Attempt created: ${attempt2._id}`)
      console.log(`    ✅ Entry fee NOT paid yet! ✨`)

      expect(attempt2.status).to.equal('committed')
    })

    it('should allow Student 3 to submit attempt', async function() {
      console.log('\n  👨‍🎓 Student 3 submitting attempt...')

      const { tx: attemptTx, effect: attemptEffect } = await withRetry(
        () => student3Computer.encode({
          mod: attemptModuleSpec,
          exp: `new QuizAttempt("${student3PubKey}", "${quizId}", "${student3Data.commitment}", BigInt(${entryFee}), "${teacherPubKey}")`
        }),
        'Encode student 3 attempt'
      )

      await withRetry(
        () => student3Computer.broadcast(attemptTx),
        'Broadcast student 3 attempt'
      )

      attempt3 = attemptEffect.res
      await sleep(3000)

      console.log(`    ✅ Attempt created: ${attempt3._id}`)
      console.log(`    ✅ Entry fee NOT paid yet! ✨`)

      expect(attempt3.status).to.equal('committed')
    })
  })

  describe('Phase 3: Teacher Reveal & Students Verify', () => {
    it('should allow teacher to reveal answers', async function() {
      console.log('\n  🔓 Teacher revealing answers...')

      await sleep(2000)

      const syncedQuiz = await teacherComputer.sync(quiz._rev)

      const { tx: revealTx } = await withRetry(
        () => teacherComputer.encodeCall({
          target: syncedQuiz,
          property: 'revealAnswers',
          args: [correctAnswers, salt],
          mod: quizModuleSpec
        }),
        'Encode revealAnswers call'
      )

      await withRetry(
        () => teacherComputer.broadcast(revealTx),
        'Broadcast revealAnswers'
      )

      await sleep(3000)

      const [latestRev] = await teacherComputer.query({ ids: [quiz._id] })
      quiz = await teacherComputer.sync(latestRev)

      console.log(`    ✅ Answers revealed: ${quiz.revealedAnswers.join(', ')}`)

      expect(quiz.status).to.equal('revealed')
    })

    it('should verify Student 1 (WINNER)', async function() {
      console.log('\n  📊 Verifying Student 1...')

      const score = calculateScore(student1Data.answers, correctAnswers)
      const passed = didPass(score.percentage, passThreshold, correctAnswers.length)

      console.log(`    Score: ${score.correct}/${score.total} = ${score.percentage}%`)
      console.log(`    Result: ${passed ? '✅ PASSED' : '❌ FAILED'}`)

      const syncedAttempt = await student1Computer.sync(attempt1._rev)

      const { tx: verifyTx } = await withRetry(
        () => student1Computer.encodeCall({
          target: syncedAttempt,
          property: 'verify',
          args: [score.percentage, passed],
          mod: attemptModuleSpec
        }),
        'Encode verify call'
      )

      await withRetry(
        () => student1Computer.broadcast(verifyTx),
        'Broadcast verify'
      )

      await sleep(3000)

      const [verifiedAttemptRev] = await student1Computer.query({ ids: [attempt1._id] })
      attempt1 = await student1Computer.sync(verifiedAttemptRev)

      expect(attempt1.passed).to.be.true
    })

    it('should verify Student 2 (LOSER)', async function() {
      console.log('\n  📊 Verifying Student 2...')

      const score = calculateScore(student2Data.answers, correctAnswers)
      const passed = didPass(score.percentage, passThreshold, correctAnswers.length)

      console.log(`    Score: ${score.correct}/${score.total} = ${score.percentage}%`)
      console.log(`    Result: ${passed ? '✅ PASSED' : '❌ FAILED'}`)

      const syncedAttempt = await student2Computer.sync(attempt2._rev)

      const { tx: verifyTx } = await withRetry(
        () => student2Computer.encodeCall({
          target: syncedAttempt,
          property: 'verify',
          args: [score.percentage, passed],
          mod: attemptModuleSpec
        }),
        'Encode verify call'
      )

      await withRetry(
        () => student2Computer.broadcast(verifyTx),
        'Broadcast verify'
      )

      await sleep(3000)

      const [verifiedAttemptRev] = await student2Computer.query({ ids: [attempt2._id] })
      attempt2 = await student2Computer.sync(verifiedAttemptRev)

      expect(attempt2.passed).to.be.false
    })

    it('should verify Student 3 (LOSER)', async function() {
      console.log('\n  📊 Verifying Student 3...')

      const score = calculateScore(student3Data.answers, correctAnswers)
      const passed = didPass(score.percentage, passThreshold, correctAnswers.length)

      console.log(`    Score: ${score.correct}/${score.total} = ${score.percentage}%`)
      console.log(`    Result: ${passed ? '✅ PASSED' : '❌ FAILED'}`)

      const syncedAttempt = await student3Computer.sync(attempt3._rev)

      const { tx: verifyTx } = await withRetry(
        () => student3Computer.encodeCall({
          target: syncedAttempt,
          property: 'verify',
          args: [score.percentage, passed],
          mod: attemptModuleSpec
        }),
        'Encode verify call'
      )

      await withRetry(
        () => student3Computer.broadcast(verifyTx),
        'Broadcast verify'
      )

      await sleep(3000)

      const [verifiedAttemptRev] = await student3Computer.query({ ids: [attempt3._id] })
      attempt3 = await student3Computer.sync(verifiedAttemptRev)

      expect(attempt3.passed).to.be.false
    })
  })

  describe('Phase 4: Winner Claims Prize via Atomic Swap', () => {
    it('should create prize Payment for Student 1 (winner)', async function() {
      console.log('\n  💰 Teacher creating Prize Payment for Student 1...')

      const { tx: prizeTx, effect: prizeEffect } = await withRetry(
        () => teacherComputer.encode({
          mod: quizModuleSpec,
          exp: `new Payment("${student1PubKey}", BigInt(${prizePool}), "Quiz Prize", "${attempt1._id}")`
        }),
        'Encode Prize Payment'
      )

      await withRetry(
        () => teacherComputer.broadcast(prizeTx),
        'Broadcast Prize Payment'
      )

      prizePayment1 = prizeEffect.res
      await sleep(3000)

      console.log(`    ✅ Prize Payment created: ${prizePayment1._id}`)
      console.log(`    ✅ Amount: ${prizePayment1.amount.toLocaleString()} sats`)

      expect(prizePayment1.recipient).to.equal(student1PubKey)
    })

    it('should execute atomic swap for Student 1 (winner pays entry fee, receives prize)', async function() {
      console.log('\n  🎁 Student 1 claiming prize via atomic swap...')

      // Student 1 creates entry fee Payment
      console.log('    Step 1: Student 1 creates entry fee Payment...')
      const { tx: entryFeeTx, effect: entryFeeEffect} = await withRetry(
        () => student1Computer.encode({
          mod: quizModuleSpec,
          exp: `new Payment("${teacherPubKey}", BigInt(${entryFee}), "Entry Fee", "${attempt1._id}")`
        }),
        'Encode Entry Fee Payment'
      )

      await withRetry(
        () => student1Computer.broadcast(entryFeeTx),
        'Broadcast Entry Fee Payment'
      )

      const entryFeePayment1 = entryFeeEffect.res
      await sleep(3000)

      console.log(`      ✅ Entry fee Payment created`)

      // Teacher creates swap transaction
      console.log('    Step 2: Teacher creating swap transaction...')
      const { tx: swapTx } = await withRetry(
        () => teacherComputer.encode({
          exp: `${PrizeSwap} PrizeSwap.exec(prizePayment, entryFeePayment, attempt)`,
          env: {
            prizePayment: prizePayment1._rev,
            entryFeePayment: entryFeePayment1._rev,
            attempt: attempt1._rev
          },
          mod: swapModuleSpec
        }),
        'Encode atomic swap'
      )

      // Student signs and broadcasts
      console.log('    Step 3: Student 1 signing and broadcasting...')
      await student1Computer.sign(swapTx)
      await withRetry(
        () => student1Computer.broadcast(swapTx),
        'Broadcast atomic swap'
      )

      await sleep(3000)

      // Verify swap results
      const [latestPrizeRev] = await student1Computer.query({ ids: [prizePayment1._id] })
      const [latestEntryFeeRev] = await teacherComputer.query({ ids: [entryFeePayment1._id] })

      const finalPrizePayment = await student1Computer.sync(latestPrizeRev)
      const finalEntryFeePayment = await teacherComputer.sync(latestEntryFeeRev)

      console.log(`    ✅ Prize Payment now owned by: ${finalPrizePayment._owners[0] === student1PubKey ? 'Student 1 ✅' : 'Teacher ❌'}`)
      console.log(`    ✅ Entry Fee Payment now owned by: ${finalEntryFeePayment._owners[0] === teacherPubKey ? 'Teacher ✅' : 'Student ❌'}`)

      expect(finalPrizePayment._owners[0]).to.equal(student1PubKey)
      expect(finalEntryFeePayment._owners[0]).to.equal(teacherPubKey)
    })
  })

  describe('Phase 5: Losers Transfer Entry Fees to Teacher', () => {
    it('should transfer Student 2 entry fee to teacher (simple transfer)', async function() {
      console.log('\n  💸 Student 2 (loser) transferring entry fee to teacher...')

      // Student 2 creates entry fee Payment
      console.log('    Step 1: Student 2 creates entry fee Payment...')
      const { tx: entryFeeTx, effect: entryFeeEffect} = await withRetry(
        () => student2Computer.encode({
          mod: quizModuleSpec,
          exp: `new Payment("${teacherPubKey}", BigInt(${entryFee}), "Entry Fee - Failed Attempt", "${attempt2._id}")`
        }),
        'Encode Entry Fee Payment'
      )

      await withRetry(
        () => student2Computer.broadcast(entryFeeTx),
        'Broadcast Entry Fee Payment'
      )

      const entryFeePayment2 = entryFeeEffect.res
      await sleep(3000)

      console.log(`      ✅ Entry fee Payment created: ${entryFeePayment2._id}`)
      console.log(`      ✅ Initially owned by: Student 2`)

      // Transfer ownership to teacher using encodeCall
      console.log('    Step 2: Student 2 transferring ownership to teacher...')
      const syncedPayment = await student2Computer.sync(entryFeePayment2._rev)

      const { tx: transferTx } = await withRetry(
        () => student2Computer.encodeCall({
          target: syncedPayment,
          property: 'transfer',
          args: [teacherPubKey],
          mod: quizModuleSpec
        }),
        'Encode transfer call'
      )

      await withRetry(
        () => student2Computer.broadcast(transferTx),
        'Broadcast transfer'
      )

      await sleep(3000)

      // Verify transfer
      const [latestRev] = await teacherComputer.query({ ids: [entryFeePayment2._id] })
      const finalPayment = await teacherComputer.sync(latestRev)

      console.log(`    ✅ Entry fee Payment now owned by: ${finalPayment._owners[0] === teacherPubKey ? 'Teacher ✅' : 'Student ❌'}`)
      console.log(`    ✅ Loser paid entry fee without receiving prize`)

      expect(finalPayment._owners[0]).to.equal(teacherPubKey)
    })

    it('should transfer Student 3 entry fee to teacher (simple transfer)', async function() {
      console.log('\n  💸 Student 3 (loser) transferring entry fee to teacher...')

      // Student 3 creates entry fee Payment
      console.log('    Step 1: Student 3 creates entry fee Payment...')
      const { tx: entryFeeTx, effect: entryFeeEffect} = await withRetry(
        () => student3Computer.encode({
          mod: quizModuleSpec,
          exp: `new Payment("${teacherPubKey}", BigInt(${entryFee}), "Entry Fee - Failed Attempt", "${attempt3._id}")`
        }),
        'Encode Entry Fee Payment'
      )

      await withRetry(
        () => student3Computer.broadcast(entryFeeTx),
        'Broadcast Entry Fee Payment'
      )

      const entryFeePayment3 = entryFeeEffect.res
      await sleep(3000)

      console.log(`      ✅ Entry fee Payment created: ${entryFeePayment3._id}`)

      // Transfer ownership to teacher
      console.log('    Step 2: Student 3 transferring ownership to teacher...')
      const syncedPayment = await student3Computer.sync(entryFeePayment3._rev)

      const { tx: transferTx } = await withRetry(
        () => student3Computer.encodeCall({
          target: syncedPayment,
          property: 'transfer',
          args: [teacherPubKey],
          mod: quizModuleSpec
        }),
        'Encode transfer call'
      )

      await withRetry(
        () => student3Computer.broadcast(transferTx),
        'Broadcast transfer'
      )

      await sleep(3000)

      // Verify transfer
      const [latestRev] = await teacherComputer.query({ ids: [entryFeePayment3._id] })
      const finalPayment = await teacherComputer.sync(latestRev)

      console.log(`    ✅ Entry fee Payment now owned by: ${finalPayment._owners[0] === teacherPubKey ? 'Teacher ✅' : 'Student ❌'}`)
      console.log(`    ✅ Loser paid entry fee without receiving prize`)

      expect(finalPayment._owners[0]).to.equal(teacherPubKey)
    })
  })

  describe('✅ Test Summary', () => {
    it('should display complete test summary', () => {
      console.log('\n' + '='.repeat(80))
      console.log('  🎉 COMPREHENSIVE TEST COMPLETED SUCCESSFULLY')
      console.log('='.repeat(80))
      console.log('')
      console.log('  ✅ Verified:')
      console.log('    • Quiz creation with deferred payment model')
      console.log('    • 3 students submitted attempts (NO upfront payment)')
      console.log('    • Teacher revealed answers')
      console.log('    • 1 winner (100% score) - claimed prize via ATOMIC SWAP')
      console.log('    • 2 losers (33% and 0% scores) - paid entry fees via SIMPLE TRANSFER')
      console.log('    • Teacher received:')
      console.log('      - 2 entry fees from losers (10,000 sats)')
      console.log('      - 1 entry fee from winner via swap (5,000 sats)')
      console.log('      - Total collected: 15,000 sats')
      console.log('    • Teacher paid out:')
      console.log('      - 1 prize to winner (50,000 sats)')
      console.log('      - Net: -35,000 sats + gas fees')
      console.log('')
      console.log('  🚀 Deferred Payment Model with Mixed Outcomes Working Perfectly!')
      console.log('  📊 Economic Model:')
      console.log('    - Winners: Atomic swap (entry fee ↔ prize)')
      console.log('    - Losers: Simple transfer (entry fee → teacher)')
      console.log('='.repeat(80))
    })
  })
})
