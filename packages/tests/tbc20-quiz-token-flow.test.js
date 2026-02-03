/**
 * TBC20 QUIZ FUNGIBLE TOKEN FLOW INTEGRATION TEST
 * Bitcoin Computer Quiz Platform - Quiz as Fungible Token + On-Demand Minting
 *
 * ARCHITECTURAL CHANGE: Quiz itself is now the fungible token!
 *
 * PHASE 1: Quiz Fungible Token Creation & Minting (TBC20)
 *   - Teacher creates Quiz as fungible token (initial supply)
 *   - Quiz extends Token extends Contract
 *   - Quiz contains all metadata (questions, entry fee, prize pool, etc.)
 *
 * PHASE 2: Quiz Token Purchase (TBC20 + EXEC)
 *   - Students buy quiz tokens via exec pattern
 *   - TBC20 transfer splits: teacher's supply reduces, student gets new UTXO
 *   - Entry fee paid atomically
 *
 * PHASE 3: Quiz Token Redemption & Attempt Creation
 *   - Students redeem quiz token → creates QuizAttempt
 *   - Quiz token gets burned (amount set to 0)
 *   - Students submit answers after redemption
 *
 * PHASE 4: Teacher Reveal & Scoring
 *   - Teacher reveals correct answers
 *   - Students verify themselves
 *
 * PHASE 5: Prize Distribution (SWAP)
 *   - Winners swap AnswerProof for prize
 */

import { describe, it, before } from 'mocha'
import { expect } from 'chai'
import { Computer, Transaction } from '@bitcoin-computer/lib'
import crypto from 'crypto'
import dotenv from 'dotenv'

// Import deployed contracts
// Note: Token is inlined in Quiz.deploy.js, so we import both from there
import { Token, Quiz } from '@bizz/contracts/deploy/Quiz.deploy.js'
import { Payment } from '@bizz/contracts/deploy/Payment.deploy.js'
import { QuizAttempt } from '@bizz/contracts/deploy/QuizAttempt.deploy.js'
import { QuizAccess } from '@bizz/contracts/deploy/QuizAccess.deploy.js'
import { QuizRedemption } from '@bizz/contracts/deploy/QuizRedemption.deploy.js'
import { AnswerProof } from '@bizz/contracts/deploy/AnswerProof.deploy.js'
import { PrizeSwap } from '@bizz/contracts/deploy/PrizeSwap.deploy.js'

dotenv.config({ path: '.env.local' })

const { SIGHASH_SINGLE, SIGHASH_ANYONECANPAY } = Transaction

// ============================================================================
// MOCK CLASSES FOR PARTIAL SIGNING
// ============================================================================

const mockedRev = `mock-${'0'.repeat(64)}:0`

class PaymentMock {
  constructor(satoshis, recipient, purpose, reference) {
    this._id = mockedRev
    this._rev = mockedRev
    this._root = mockedRev
    this._satoshis = satoshis
    this._owners = recipient ? [recipient] : []
    this.recipient = recipient || ''
    this.amount = satoshis
    this.purpose = purpose || 'Entry Fee'
    this.reference = reference || ''
    this.status = 'unclaimed'
    this.createdAt = Date.now()
    this.claimedAt = null
  }

  transfer(to) {
    this._owners = [to]
    this.recipient = to
  }
}

class AnswerProofMock {
  constructor(student, quizRef, attemptRef, answers, score, passed) {
    this._id = mockedRev
    this._rev = mockedRev
    this._root = mockedRev
    this._satoshis = BigInt(546)
    this._owners = [student]
    this.student = student
    this.quizRef = quizRef
    this.attemptRef = attemptRef
    this.answers = answers
    this.score = score
    this.passed = passed
  }

  transfer(to) {
    this._owners = [to]
  }
}

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

function didPass(score, threshold) {
  return score >= threshold
}

function displayBalanceChange(label, before, after) {
  const diff = after - before
  const sign = diff >= 0n ? '+' : ''
  console.log(`      ${label}:`)
  console.log(`        Before: ${before.toLocaleString()} sats`)
  console.log(`        After:  ${after.toLocaleString()} sats`)
  console.log(`        Change: ${sign}${diff.toLocaleString()} sats`)
}

async function mineBlockFromRPCClient(computer) {
  try {
    const newAddress = await computer.rpcCall('getnewaddress', 'mywallet legacy')
    console.log(`        Mining block...`)
    await computer.rpcCall('generatetoaddress', `1 ${newAddress.result}`)
    await sleep(2000)
  } catch (error) {
    console.log('      ❌ Error mining block:', error.message)
  }
}

async function withRetry(operation, operationName, computer, maxRetries = 5) {
  let lastError = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      const isMempoolConflict = error.message.includes('txn-mempool-conflict')
      const isTooLongChain = error.message.includes('too-long-mempool-chain')

      if (isTooLongChain || isMempoolConflict) {
        if (attempt === maxRetries) {
          throw error
        }
        console.log(`      ⏳ ${operationName}: Mempool issue, mining block... (${attempt}/${maxRetries})`)
        await mineBlockFromRPCClient(computer)
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

describe('🎓 TBC20 QUIZ FUNGIBLE TOKEN FLOW - Quiz as Token + On-Demand Minting', function () {
  this.timeout(600000) // 10 minutes for blockchain operations

  // Test wallets
  let teacherComputer, student1Computer, student2Computer
  let teacherPubKey, student1PubKey, student2PubKey

  // Contract module specs
  let tokenModuleSpec, paymentModuleSpec, quizModuleSpec, attemptModuleSpec
  let quizAccessModuleSpec, quizRedemptionModuleSpec, proofModuleSpec, swapModuleSpec

  // Test data
  const correctAnswers = ['Paris', '4', 'Blue']
  const salt = generateSalt()
  const entryFee = BigInt(5000)  // 5,000 sats
  const prizePool = BigInt(50000) // 50,000 sats
  const passThreshold = 70
  const initialQuizSupply = 100n  // Teacher mints 100 quiz tokens initially

  // Quiz fungible token data
  let quiz  // Teacher's quiz fungible token UTXO
  let quizId, answerHashes
  let student1Quiz, student2Quiz  // Student quiz token UTXOs

  // Attempt data
  let attempt1, attempt2
  let student1Answers, student2Answers
  let commitment1, commitment2

  // Winner data
  let answerProof1, prizePayment1

  before(async function () {
    console.log('\n' + '='.repeat(80))
    console.log('  🎓 INITIALIZING QUIZ FUNGIBLE TOKEN TEST ENVIRONMENT')
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

    teacherPubKey = teacherComputer.getPublicKey()
    student1PubKey = student1Computer.getPublicKey()
    student2PubKey = student2Computer.getPublicKey()

    console.log(`    ✅ Teacher wallet: ${teacherComputer.getAddress()}`)
    console.log(`    ✅ Student 1 wallet: ${student1Computer.getAddress()}`)
    console.log(`    ✅ Student 2 wallet: ${student2Computer.getAddress()}`)

    console.log('\n  💰 Funding wallets from faucet...')
    await teacherComputer.faucet(10000000) // 10M sats
    await student1Computer.faucet(5000000)  // 5M sats each
    await student2Computer.faucet(5000000)

    console.log(`    ✅ Teacher funded: ${(await teacherComputer.getBalance()).balance.toLocaleString()} sats`)
    console.log(`    ✅ Students funded: 5M sats each`)

    // Mine blocks after funding
    await mineBlockFromRPCClient(teacherComputer)
    await sleep(2000)
    await mineBlockFromRPCClient(teacherComputer)
    await sleep(2000)

    console.log('\n  📦 Deploying contract modules...')

    // Deploy Token and Quiz together since Quiz extends Token
    quizModuleSpec = await withRetry(
      () => teacherComputer.deploy(`export ${Token}\nexport ${Quiz}`),
      'Deploy Token + Quiz module',
      teacherComputer,
      10
    )
    console.log(`    ✅ Token + Quiz module deployed`)
    await mineBlockFromRPCClient(teacherComputer)
    await sleep(3000)

    paymentModuleSpec = await withRetry(
      () => teacherComputer.deploy(`export ${Payment}`),
      'Deploy Payment module',
      teacherComputer,
      10
    )
    console.log(`    ✅ Payment module deployed`)
    await mineBlockFromRPCClient(teacherComputer)
    await sleep(3000)

    attemptModuleSpec = await withRetry(
      () => teacherComputer.deploy(`export ${QuizAttempt}`),
      'Deploy QuizAttempt module',
      teacherComputer,
      10
    )
    console.log(`    ✅ QuizAttempt module deployed`)
    await mineBlockFromRPCClient(teacherComputer)
    await sleep(3000)

    quizAccessModuleSpec = await withRetry(
      () => teacherComputer.deploy(`export ${QuizAccess}`),
      'Deploy QuizAccess module',
      teacherComputer,
      10
    )
    console.log(`    ✅ QuizAccess module deployed`)
    await mineBlockFromRPCClient(teacherComputer)
    await sleep(3000)

    quizRedemptionModuleSpec = await withRetry(
      () => teacherComputer.deploy(`export ${QuizRedemption}`),
      'Deploy QuizRedemption module',
      teacherComputer,
      10
    )
    console.log(`    ✅ QuizRedemption module deployed`)
    await mineBlockFromRPCClient(teacherComputer)
    await sleep(3000)

    proofModuleSpec = await withRetry(
      () => teacherComputer.deploy(`export ${AnswerProof}`),
      'Deploy AnswerProof module',
      teacherComputer,
      10
    )
    console.log(`    ✅ AnswerProof module deployed`)
    await mineBlockFromRPCClient(teacherComputer)
    await sleep(3000)

    swapModuleSpec = await withRetry(
      () => teacherComputer.deploy(`export ${PrizeSwap}`),
      'Deploy PrizeSwap module',
      teacherComputer,
      10
    )
    console.log(`    ✅ PrizeSwap module deployed`)

    console.log('\n  📝 Preparing quiz data...')
    answerHashes = correctAnswers.map((answer, index) =>
      hashAnswer('quiz-id', index, answer, salt)
    )

    // Student answers: S1=100%, S2=0%
    student1Answers = ['Paris', '4', 'Blue']    // 100% - PASS
    student2Answers = ['London', '3', 'Red']    // 0% - FAIL

    console.log(`    ✅ Quiz prepared with ${correctAnswers.length} questions`)
    console.log(`    ✅ Pass threshold: ${passThreshold}%`)

    console.log('\n' + '='.repeat(80))
    console.log('  ✅ SETUP COMPLETE - Ready to run tests')
    console.log('='.repeat(80) + '\n')
  })

  describe('Phase 1: Quiz Fungible Token Creation & Purchase', () => {
    it('should create Quiz as fungible token with metadata', async function () {
      console.log('\n  🪙 Creating Quiz as fungible token...')

      const teacherBalanceBefore = (await teacherComputer.getBalance()).balance

      const deadline = Date.now() + 30000
      const teacherRevealDeadline = deadline + (5 * 60 * 1000)
      const questionHashIPFS = 'QmTest123'
      const symbol = 'MATH101'

      // Create Quiz as fungible token extending Token extending Contract
      const { tx, effect } = await withRetry(
        () => teacherComputer.encode({
          mod: quizModuleSpec,
          exp: `new Quiz("${teacherPubKey}", BigInt(${initialQuizSupply}), "${symbol}", "${teacherPubKey}", "${questionHashIPFS}", ${JSON.stringify(answerHashes)}, BigInt(${prizePool}), BigInt(${entryFee}), ${passThreshold}, ${deadline}, ${teacherRevealDeadline})`
        }),
        'Encode Quiz creation',
        teacherComputer
      )

      await withRetry(
        () => teacherComputer.broadcast(tx),
        'Broadcast Quiz creation',
        teacherComputer
      )

      quiz = effect.res
      quizId = quiz._id

      await sleep(3000)
      const teacherBalanceAfter = (await teacherComputer.getBalance()).balance

      console.log(`    ✅ Quiz fungible token created: ${quizId.substring(0, 20)}...`)
      console.log(`    ✅ Symbol: ${quiz.symbol}`)
      console.log(`    ✅ Initial supply: ${quiz.amount}`)
      console.log(`    ✅ Status: ${quiz.status}`)
      console.log(`    ✅ Entry fee (metadata): ${quiz.entryFee.toLocaleString()} sats`)
      console.log(`    ✅ Prize pool (metadata): ${quiz.prizePool.toLocaleString()} sats`)

      displayBalanceChange('Teacher Balance', teacherBalanceBefore, teacherBalanceAfter)

      expect(quiz.amount).to.equal(initialQuizSupply)
      expect(quiz.symbol).to.equal(symbol)
      expect(quiz.status).to.equal('active')
      expect(quiz.prizePool).to.equal(prizePool)
      expect(quiz.entryFee).to.equal(entryFee)
      expect(quiz.teacher).to.equal(teacherPubKey)
    })

    it('should allow student 1 to purchase quiz token via exec (TBC20)', async function () {
      console.log('\n  💰 Student 1 purchasing Quiz token via EXEC...')

      await mineBlockFromRPCClient(teacherComputer)

      const student1BalanceBefore = (await student1Computer.getBalance()).balance
      const teacherBalanceBefore = (await teacherComputer.getBalance()).balance

      console.log(`\n    📊 Before purchase:`)
      console.log(`      Teacher's Quiz token balance: ${quiz.amount}`)

      // STEP 1: Teacher creates mock payment and partially signed exec transaction
      console.log('\n    📝 Step 1: Teacher creating partially signed exec transaction...')

      const paymentMock = new PaymentMock(entryFee, teacherPubKey, 'Entry Fee', quizId)
      console.log(`      ✅ Mock payment created`)

      const { tx: partialExecTx } = await withRetry(
        () => teacherComputer.encode({
          exp: `${QuizAccess} QuizAccess.exec(quizToken, entryFeePayment)`,
          env: {
            quizToken: quiz._rev,
            entryFeePayment: paymentMock._rev
          },
          mocks: { entryFeePayment: paymentMock },
          mod: quizAccessModuleSpec,
          sighashType: SIGHASH_SINGLE | SIGHASH_ANYONECANPAY,
          inputIndex: 0,
          fund: false,
          sign: true
        }),
        'Create partial exec transaction',
        teacherComputer
      )

      console.log(`      ✅ Teacher partially signed exec transaction`)

      // STEP 2: Student creates real entry fee Payment
      console.log('\n    💰 Step 2: Student creating real entry fee payment...')

      await mineBlockFromRPCClient(student1Computer)

      const { tx: paymentTx, effect: paymentEffect } = await withRetry(
        () => student1Computer.encode({
          mod: paymentModuleSpec,
          exp: `new Payment("${teacherPubKey}", BigInt(${entryFee}), "Entry Fee", "${quizId}")`
        }),
        'Create entry fee payment',
        student1Computer
      )

      await student1Computer.broadcast(paymentTx)
      const entryFeePayment1 = paymentEffect.res

      await sleep(3000)
      console.log(`      ✅ Student created entry fee payment`)

      // STEP 3: Student updates partial transaction with real payment
      console.log('\n     Step 3: Student completing exec transaction...')

      const [paymentTxId, paymentIndex] = entryFeePayment1._rev.split(':')
      partialExecTx.updateInput(1, {
        txId: paymentTxId,
        index: parseInt(paymentIndex, 10)
      })

      partialExecTx.updateOutput(1, { scriptPubKey: student1Computer.toScriptPubKey() })

      await student1Computer.fund(partialExecTx)
      await student1Computer.sign(partialExecTx)

      await withRetry(
        () => student1Computer.broadcast(partialExecTx),
        'Broadcast exec transaction',
        student1Computer
      )

      await sleep(3000)

      // STEP 4: Query updated states
      console.log('\n     Step 4: Verifying TBC20 exec results...')

      const [latestQuizRev] = await teacherComputer.query({ ids: [quiz._id] })
      quiz = await teacherComputer.sync(latestQuizRev)

      const student1QuizRevs = await student1Computer.query({
        publicKey: student1PubKey,
        order: 'DESC'
      })

      for (const rev of student1QuizRevs) {
        const obj = await student1Computer.sync(rev)
        if (obj.symbol === 'MATH101' && obj.amount === 1n) {
          student1Quiz = obj
          break
        }
      }

      const student1BalanceAfter = (await student1Computer.getBalance()).balance
      const teacherBalanceAfter = (await teacherComputer.getBalance()).balance

      console.log(`\n    📊 After purchase (TBC20 split):`)
      console.log(`      Teacher's Quiz balance: ${quiz.amount} (reduced by 1)`)
      console.log(`      Student 1 Quiz token: ${student1Quiz ? student1Quiz.amount : 'NOT FOUND'}`)
      console.log(`      Student 1 Quiz owner: ${student1Quiz ? (student1Quiz._owners[0] === student1PubKey ? 'Student 1 ✅' : 'NOT STUDENT ❌') : 'N/A'}`)

      displayBalanceChange('Student 1 Balance', student1BalanceBefore, student1BalanceAfter)
      displayBalanceChange('Teacher Balance', teacherBalanceBefore, teacherBalanceAfter)

      expect(quiz.amount).to.equal(99n)
      expect(student1Quiz).to.not.be.undefined
      expect(student1Quiz.amount).to.equal(1n)
      expect(student1Quiz._owners[0]).to.equal(student1PubKey)
      expect(student1Quiz.symbol).to.equal('MATH101')
    })

    it('should allow student 1 to redeem quiz token and create quiz attempt', async function () {
      console.log('\n  🔥 Student 1 redeeming Quiz token to create QuizAttempt...')

      await mineBlockFromRPCClient(student1Computer)

      console.log(`\n    📊 Before redemption:`)
      console.log(`      Student 1 Quiz token balance: ${student1Quiz.amount}`)
      console.log(`      Student 1 Quiz token originalQuizId: ${student1Quiz.originalQuizId || '(empty)'}`)
      console.log(`      Student 1 Quiz token _id: ${student1Quiz._id}`)
      console.log(`      Student 1 Quiz token teacher: ${student1Quiz.teacher}`)
      console.log(`      Original quizId variable: ${quizId}`)

      // Use originalQuizId from student's quiz token (or its _id if originalQuizId is empty)
      const correctQuizId = student1Quiz.originalQuizId || student1Quiz._id
      console.log(`      Using quizId for QuizAttempt: ${correctQuizId}`)

      // STEP 1: Student creates QuizAttempt
      console.log(`\n    📝 Step 1: Creating QuizAttempt...`)
      const { tx: attemptTx, effect: attemptEffect } = await withRetry(
        () => student1Computer.encode({
          mod: attemptModuleSpec,
          exp: `new QuizAttempt("${student1PubKey}", "${correctQuizId}", "", BigInt(${entryFee}), "${student1Quiz.teacher}")`
        }),
        'Create quiz attempt',
        student1Computer
      )

      await student1Computer.broadcast(attemptTx)
      const tempAttempt1 = attemptEffect.res

      await sleep(3000)
      console.log(`      ✅ QuizAttempt created`)

      // STEP 2: Student redeems quiz token
      console.log(`\n    🔥 Step 2: Redeeming Quiz token (burning it)...`)

      const [latestQuizTokenRev] = await student1Computer.query({ ids: [student1Quiz._id] })
      const syncedQuizToken = await student1Computer.sync(latestQuizTokenRev)

      const [latestAttemptRev] = await student1Computer.query({ ids: [tempAttempt1._id] })
      const syncedAttempt = await student1Computer.sync(latestAttemptRev)

      const { tx: redeemTx, effect: redeemEffect } = await withRetry(
        () => student1Computer.encode({
          exp: `${QuizRedemption} QuizRedemption.redeem(quizToken, quizAttempt)`,
          env: {
            quizToken: syncedQuizToken._rev,
            quizAttempt: syncedAttempt._rev
          },
          mod: quizRedemptionModuleSpec
        }),
        'Redeem quiz token',
        student1Computer
      )

      await withRetry(
        () => student1Computer.broadcast(redeemTx),
        'Broadcast redemption',
        student1Computer
      )

      const [burnedQuizToken, validatedAttempt] = redeemEffect.res
      attempt1 = validatedAttempt

      await sleep(3000)

      const [burnedTokenRev] = await student1Computer.query({ ids: [student1Quiz._id] })
      const finalQuizToken = await student1Computer.sync(burnedTokenRev)

      console.log(`\n    📊 After redemption:`)
      console.log(`      Quiz token amount: ${finalQuizToken.amount} (BURNED! ✅)`)
      console.log(`      QuizAttempt status: ${attempt1.status}`)
      console.log(`      QuizAttempt isRedeemed: ${attempt1.isRedeemed}`)

      expect(finalQuizToken.amount).to.equal(0n)
      expect(attempt1.status).to.equal('owned')
      expect(attempt1.isRedeemed).to.be.true
      expect(attempt1._owners[0]).to.equal(student1PubKey)
    })

    it('should allow student 1 to submit answers after redemption', async function () {
      console.log('\n  ✍️ Student 1 submitting answers...')

      await mineBlockFromRPCClient(student1Computer)

      commitment1 = hashCommitment(student1Answers, generateSalt())

      const syncedAttempt1 = await student1Computer.sync(attempt1._rev)

      const { tx: submitTx } = await withRetry(
        () => student1Computer.encodeCall({
          target: syncedAttempt1,
          property: 'submitCommitment',
          args: [commitment1],
          mod: attemptModuleSpec
        }),
        'Submit commitment',
        student1Computer
      )

      await withRetry(
        () => student1Computer.broadcast(submitTx),
        'Broadcast submission',
        student1Computer
      )

      await sleep(3000)

      const [latestRev] = await student1Computer.query({ ids: [attempt1._id] })
      attempt1 = await student1Computer.sync(latestRev)

      console.log(`    ✅ Answers submitted`)
      console.log(`    ✅ Status: ${attempt1.status}`)

      expect(attempt1.status).to.equal('committed')
      expect(attempt1.answerCommitment).to.equal(commitment1)
    })
  })

  describe('Phase 2: Teacher Reveal & Scoring', () => {
    it('should allow teacher to reveal answers', async function () {
      console.log('\n  🔓 Teacher revealing answers...')

      await sleep(2000)
      await mineBlockFromRPCClient(teacherComputer)

      // Sync latest quiz state (remember quiz is the fungible token)
      const [latestQuizRev] = await teacherComputer.query({ ids: [quiz._id] })
      const syncedQuiz = await teacherComputer.sync(latestQuizRev)

      const { tx: revealTx } = await withRetry(
        () => teacherComputer.encodeCall({
          target: syncedQuiz,
          property: 'revealAnswers',
          args: [correctAnswers, salt],
          mod: quizModuleSpec
        }),
        'Reveal answers',
        teacherComputer
      )

      await withRetry(
        () => teacherComputer.broadcast(revealTx),
        'Broadcast reveal',
        teacherComputer
      )

      await sleep(3000)

      const [revealedQuizRev] = await teacherComputer.query({ ids: [quiz._id] })
      quiz = await teacherComputer.sync(revealedQuizRev)

      console.log(`    ✅ Quiz status: ${quiz.status}`)
      console.log(`    ✅ Revealed answers: ${quiz.revealedAnswers.join(', ')}`)

      expect(quiz.status).to.equal('revealed')
      expect(quiz.revealedAnswers).to.deep.equal(correctAnswers)
    })

    it('should verify student attempt', async function () {
      console.log('\n  ✅ Student 1 verifying their attempt...')

      await mineBlockFromRPCClient(student1Computer)

      const score1 = calculateScore(student1Answers, correctAnswers)
      const passed1 = didPass(score1.percentage, passThreshold)

      const syncedAttempt1 = await student1Computer.sync(attempt1._rev)

      const { tx: verifyTx } = await withRetry(
        () => student1Computer.encodeCall({
          target: syncedAttempt1,
          property: 'verify',
          args: [score1.percentage, passed1],
          mod: attemptModuleSpec
        }),
        'Verify attempt',
        student1Computer
      )

      await withRetry(
        () => student1Computer.broadcast(verifyTx),
        'Broadcast verification',
        student1Computer
      )

      await sleep(3000)

      const [latestRev] = await student1Computer.query({ ids: [attempt1._id] })
      attempt1 = await student1Computer.sync(latestRev)

      console.log(`    ✅ Attempt verified: score=${attempt1.score}%, passed=${attempt1.passed}`)

      expect(attempt1.status).to.equal('verified')
      expect(attempt1.passed).to.be.true
      expect(attempt1.score).to.equal(100)
    })
  })

  describe('Phase 3: Prize Distribution (SWAP)', () => {
    it('should allow winner to create AnswerProof', async function () {
      console.log('\n  📜 Winner creating AnswerProof...')

      await mineBlockFromRPCClient(student1Computer)

      const { tx: proofTx, effect: proofEffect } = await withRetry(
        () => student1Computer.encode({
          mod: proofModuleSpec,
          exp: `new AnswerProof("${student1PubKey}", "${quizId}", "${attempt1._id}", ${JSON.stringify(student1Answers)}, ${attempt1.score}, ${attempt1.passed})`
        }),
        'Create AnswerProof',
        student1Computer
      )

      await withRetry(
        () => student1Computer.broadcast(proofTx),
        'Broadcast AnswerProof',
        student1Computer
      )

      answerProof1 = proofEffect.res

      await sleep(3000)

      console.log(`    ✅ AnswerProof created: ${answerProof1._id.substring(0, 20)}...`)
      console.log(`    ✅ Owned by: ${answerProof1._owners[0] === student1PubKey ? 'Student 1 ✅' : 'Wrong owner ❌'}`)
      console.log(`    ✅ Score: ${answerProof1.score}%, Passed: ${answerProof1.passed}`)

      expect(answerProof1._owners[0]).to.equal(student1PubKey)
      expect(answerProof1.passed).to.be.true
    })

    it('should create prize Payment for winner', async function () {
      console.log('\n  💰 Teacher creating prize Payment...')

      await mineBlockFromRPCClient(teacherComputer)

      const { tx: prizeTx, effect: prizeEffect } = await withRetry(
        () => teacherComputer.encode({
          mod: paymentModuleSpec,
          exp: `new Payment("${student1PubKey}", BigInt(${prizePool}), "Quiz Prize", "${attempt1._id}")`
        }),
        'Create prize Payment',
        teacherComputer
      )

      await withRetry(
        () => teacherComputer.broadcast(prizeTx),
        'Broadcast prize Payment',
        teacherComputer
      )

      prizePayment1 = prizeEffect.res

      await sleep(3000)

      console.log(`    ✅ Prize Payment created: ${prizePayment1._id.substring(0, 20)}...`)
      console.log(`    ✅ Amount: ${prizePayment1.amount.toLocaleString()} sats`)
      console.log(`    ✅ Owned by: Teacher (for now)`)

      expect(prizePayment1._owners[0]).to.equal(teacherPubKey)
      expect(prizePayment1.amount).to.equal(prizePool)
    })

    it('should execute prize swap atomically', async function () {
      console.log('\n  🔄 Executing prize SWAP...')

      await mineBlockFromRPCClient(teacherComputer)

      const student1BalanceBefore = (await student1Computer.getBalance()).balance

      console.log('    Step 1: Teacher creating swap transaction...')
      const { tx: swapTx } = await withRetry(
        () => teacherComputer.encode({
          exp: `${PrizeSwap} PrizeSwap.swap(prizePayment, answerProof, attempt)`,
          env: {
            prizePayment: prizePayment1._rev,
            answerProof: answerProof1._rev,
            attempt: attempt1._rev
          },
          mod: swapModuleSpec
        }),
        'Encode swap',
        teacherComputer
      )

      console.log('    ✅ Teacher created swap transaction')

      console.log('    Step 2: Student signing and broadcasting...')
      await student1Computer.sign(swapTx)
      await withRetry(
        () => student1Computer.broadcast(swapTx),
        'Broadcast swap',
        student1Computer
      )

      await sleep(3000)

      const [latestPrizeRev] = await student1Computer.query({ ids: [prizePayment1._id] })
      const [latestProofRev] = await teacherComputer.query({ ids: [answerProof1._id] })
      const [latestAttemptRev] = await student1Computer.query({ ids: [attempt1._id] })

      const finalPrize = await student1Computer.sync(latestPrizeRev)
      const finalProof = await teacherComputer.sync(latestProofRev)
      const finalAttempt = await student1Computer.sync(latestAttemptRev)

      const student1BalanceAfter = (await student1Computer.getBalance()).balance

      console.log(`\n    ✅ Swap completed successfully!`)
      console.log(`    ✅ Prize Payment now owned by: ${finalPrize._owners[0] === student1PubKey ? 'Student 1 ✅' : 'Teacher ❌'}`)
      console.log(`    ✅ Answer Proof now owned by: ${finalProof._owners[0] === teacherPubKey ? 'Teacher ✅' : 'Student ❌'}`)
      console.log(`    ✅ Attempt status: ${finalAttempt.status}`)

      displayBalanceChange('Student 1 Balance', student1BalanceBefore, student1BalanceAfter)

      expect(finalPrize._owners[0]).to.equal(student1PubKey)
      expect(finalProof._owners[0]).to.equal(teacherPubKey)
      expect(finalAttempt.status).to.equal('prize_claimed')
    })
  })

  describe('Phase 4: Full Flow Summary', () => {
    it('should display complete quiz fungible token flow summary', async function () {
      console.log('\n' + '='.repeat(80))
      console.log('  🎓 QUIZ FUNGIBLE TOKEN FLOW - COMPLETE SUMMARY')
      console.log('='.repeat(80))

      console.log('\n  📜 Architecture:')
      console.log(`    ✅ Quiz extends Token extends Contract`)
      console.log(`    ✅ Quiz IS a fungible token (not separate seat tokens)`)
      console.log(`    ✅ Quiz contains all metadata (questions, entry fee, prize pool)`)
      console.log(`    ✅ On-demand minting via TBC20 transfer pattern`)

      console.log('\n  🔄 Flow:')
      console.log(`    1️⃣ Teacher creates Quiz fungible token (initial supply: ${initialQuizSupply})`)
      console.log(`    2️⃣ Student purchases Quiz token via exec (entry fee: ${entryFee} sats)`)
      console.log(`    3️⃣ QuizAccess.exec() atomically swaps quiz token for payment`)
      console.log(`    4️⃣ Student redeems Quiz token → creates QuizAttempt (burns quiz token)`)
      console.log(`    5️⃣ Student submits answers (enforced after redemption)`)
      console.log(`    6️⃣ Teacher reveals, scores, distributes prizes (same as before)`)

      console.log(`\n  📊 Current State:`)
      console.log(`    Teacher's Quiz supply: ${quiz.amount} tokens`)
      console.log(`    Student 1 has: QuizAttempt (quiz token burned)`)
      console.log(`    Student 1 status: ${attempt1.status}`)

      console.log('\n' + '='.repeat(80))
      console.log('  ✅ QUIZ FUNGIBLE TOKEN FLOW TEST COMPLETED!')
      console.log('='.repeat(80) + '\n')
    })
  })
})
