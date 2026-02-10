import { describe, it, before } from 'mocha'
import { expect } from 'chai'
import { Computer, Transaction } from '@bitcoin-computer/lib'
import * as dotenv from 'dotenv'

// Import contract classes and Helper classes
import { Token, Quiz, QuizHelper } from '@bizz/contracts/deploy/Quiz.deploy.js'
import { Payment, PaymentHelper } from '@bizz/contracts/deploy/Payment.deploy.js'
import { QuizAttempt, QuizAttemptHelper } from '@bizz/contracts/deploy/QuizAttempt.deploy.js'
import { QuizAccess, QuizAccessHelper } from '@bizz/contracts/deploy/QuizAccess.deploy.js'
import { QuizRedemption, QuizRedemptionHelper } from '@bizz/contracts/deploy/QuizRedemption.deploy.js'
import { AnswerProof, AnswerProofHelper } from '@bizz/contracts/deploy/AnswerProof.deploy.js'
import { PrizeSwap, PrizeSwapHelper } from '@bizz/contracts/deploy/PrizeSwap.deploy.js'

// Import test helpers
import { TestHelper, QuizCrypto, QuizScoring } from './helpers/TestHelper.js'

dotenv.config({ path: '.env.local' })

const { SIGHASH_SINGLE, SIGHASH_ANYONECANPAY } = Transaction

// ============================================================================
// MOCK CLASSES FOR PARTIAL SIGNING
// ============================================================================

const mockedRev = `mock-${'0'.repeat(64)}:0`

class PaymentMock {
  _id: string
  _rev: string
  _root: string
  _satoshis: bigint
  _owners: string[]
  recipient: string
  amount: bigint
  purpose: string
  reference: string

  constructor(satoshis: bigint, recipient: string, purpose: string, reference: string) {
    this._id = mockedRev
    this._rev = mockedRev
    this._root = mockedRev
    this._satoshis = satoshis
    this._owners = recipient ? [recipient] : []
    this.recipient = recipient || ''
    this.amount = satoshis
    this.purpose = purpose || 'Entry Fee'
    this.reference = reference || ''
  }

  transfer(to: string): void {
    this._owners = [to]
  }
}

class AnswerProofMock {
  _id: string
  _rev: string
  _root: string
  _satoshis: bigint
  _owners: string[]
  student: string
  quizRef: string
  attemptRef: string
  answers: string[]
  score: number
  passed: boolean

  constructor(
    student: string,
    quizRef: string,
    attemptRef: string,
    answers: string[],
    score: number,
    passed: boolean
  ) {
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

  transfer(to: string): void {
    this._owners = [to]
  }
}

// ============================================================================
// TEST SUITE
// ============================================================================

describe('🎓 TBC20 QUIZ FUNGIBLE TOKEN FLOW - Quiz as Token + On-Demand Minting', function () {
  this.timeout(600000) // 10 minutes for blockchain operations

  // Test wallets
  let teacherComputer: Computer, student1Computer: Computer, student2Computer: Computer
  let teacherPubKey: string, student1PubKey: string, student2PubKey: string

  // Helper instances per computer (Bitcoin Computer monorepo pattern)
  let teacherQuizHelper: QuizHelper
  let teacherPaymentHelper: PaymentHelper
  let teacherAccessHelper: QuizAccessHelper
  let teacherProofHelper: AnswerProofHelper
  let teacherSwapHelper: PrizeSwapHelper

  let student1PaymentHelper: PaymentHelper
  let student1AttemptHelper: QuizAttemptHelper
  let student1RedemptionHelper: QuizRedemptionHelper
  let student1ProofHelper: AnswerProofHelper

  // Shared module IDs (same modules used by all)
  let quizMod: string
  let paymentMod: string
  let attemptMod: string
  let accessMod: string
  let redemptionMod: string
  let proofMod: string
  let swapMod: string

  // Test data
  const correctAnswers = ['Paris', '4', 'Blue']
  const salt = QuizCrypto.generateSalt()
  const entryFee = BigInt(5000) // 5,000 sats
  const prizePool = BigInt(50000) // 50,000 sats
  const passThreshold = 70
  const initialQuizSupply = BigInt(1) // Template token; mint() creates new tokens on-demand

  // Quiz fungible token data
  let quiz: any // Teacher's quiz fungible token UTXO
  let quizId: string, answerHashes: string[]
  let student1Quiz: any, student2Quiz: any // Student quiz token UTXOs

  // Attempt data
  let attempt1: any, attempt2: any
  let student1Answers: string[], student2Answers: string[]
  let commitment1: string, commitment2: string

  // Winner data
  let answerProof1: any, prizePayment1: any

  before(async function () {
    console.log('\n' + '='.repeat(80))
    console.log('  🎓 INITIALIZING QUIZ FUNGIBLE TOKEN TEST ENVIRONMENT')
    console.log('='.repeat(80))

    console.log('\n  📡 Creating Bitcoin Computer instances...')

    teacherComputer = new Computer({
      chain: process.env.CHAIN,
      network: process.env.NETWORK,
      url: process.env.URL,
      mnemonic: process.env.MNEMONIC,
      path: "m/44'/1'/0'/0/0"
    })

    student1Computer = new Computer({
      chain: process.env.CHAIN,
      network: process.env.NETWORK,
      url: process.env.URL,
      mnemonic: process.env.MNEMONIC,
      path: "m/44'/1'/0'/0/1"
    })

    student2Computer = new Computer({
      chain: process.env.CHAIN,
      network: process.env.NETWORK,
      url: process.env.URL,
      mnemonic: process.env.MNEMONIC,
      path: "m/44'/1'/0'/0/2"
    })

    teacherPubKey = teacherComputer.getPublicKey()
    student1PubKey = student1Computer.getPublicKey()
    student2PubKey = student2Computer.getPublicKey()

    console.log(`    ✅ Teacher wallet: ${teacherComputer.getAddress()}`)
    console.log(`    ✅ Student 1 wallet: ${student1Computer.getAddress()}`)
    console.log(`    ✅ Student 2 wallet: ${student2Computer.getAddress()}`)

    console.log('\n  💰 Funding wallets from faucet...')
    await teacherComputer.faucet(10000000)
    await student1Computer.faucet(5000000)
    await student2Computer.faucet(5000000)

    console.log(`    ✅ Teacher funded: 10,000,000 sats`)
    console.log(`    ✅ Students funded: 5M sats each`)

    // Mine blocks to ensure clean mempool state
    await TestHelper.mineBlocks(teacherComputer, 2)

    console.log('\n  📦 Deploying contract modules with Helper classes...')

    // Deploy modules with teacher (only once)
    teacherQuizHelper = new QuizHelper(teacherComputer)
    quizMod = await teacherQuizHelper.deploy(Token, Quiz)
    await TestHelper.waitForMempool()
    console.log(`    ✅ Token + Quiz module deployed`)

    teacherPaymentHelper = new PaymentHelper(teacherComputer)
    paymentMod = await teacherPaymentHelper.deploy()
    await TestHelper.waitForMempool()
    console.log(`    ✅ Payment module deployed`)

    const tempAttemptHelper = new QuizAttemptHelper(teacherComputer)
    attemptMod = await tempAttemptHelper.deploy()
    await TestHelper.waitForMempool()
    console.log(`    ✅ QuizAttempt module deployed`)

    teacherAccessHelper = new QuizAccessHelper(teacherComputer)
    accessMod = await teacherAccessHelper.deploy()
    await TestHelper.waitForMempool()
    console.log(`    ✅ QuizAccess module deployed`)

    const tempRedemptionHelper = new QuizRedemptionHelper(teacherComputer)
    redemptionMod = await tempRedemptionHelper.deploy()
    await TestHelper.waitForMempool()
    console.log(`    ✅ QuizRedemption module deployed`)

    teacherProofHelper = new AnswerProofHelper(teacherComputer)
    proofMod = await teacherProofHelper.deploy()
    await TestHelper.waitForMempool()
    console.log(`    ✅ AnswerProof module deployed`)

    teacherSwapHelper = new PrizeSwapHelper(teacherComputer)
    swapMod = await teacherSwapHelper.deploy()
    await TestHelper.waitForMempool()
    console.log(`    ✅ PrizeSwap module deployed`)

    // Mine block to confirm all module deployments
    await TestHelper.mineBlocks(teacherComputer, 1)

    // Create student helpers using deployed modules
    student1PaymentHelper = new PaymentHelper(student1Computer, paymentMod)
    student1AttemptHelper = new QuizAttemptHelper(student1Computer, attemptMod)
    student1RedemptionHelper = new QuizRedemptionHelper(student1Computer, redemptionMod)
    student1ProofHelper = new AnswerProofHelper(student1Computer, proofMod)

    console.log('\n  📝 Preparing quiz data...')
    answerHashes = correctAnswers.map((answer, index) =>
      QuizCrypto.hashAnswer('quiz-id', index, answer, salt)
    )

    // Student answers: S1=100%, S2=0%
    student1Answers = ['Paris', '4', 'Blue'] // 100% - PASS
    student2Answers = ['London', '3', 'Red'] // 0% - FAIL

    console.log(`    ✅ Quiz prepared with ${correctAnswers.length} questions`)
    console.log(`    ✅ Pass threshold: ${passThreshold}%`)

    console.log('\n' + '='.repeat(80))
    console.log('  ✅ SETUP COMPLETE - Ready to run tests')
    console.log('='.repeat(80) + '\n')
  })

  describe('Phase 1: Quiz Fungible Token Creation & Purchase', () => {
    it('should create Quiz as fungible token with metadata', async function () {
      console.log('\n  🪙 Creating Quiz as fungible token...')

      const teacherBalanceBefore = (await TestHelper.getBalance(teacherComputer)).balance

      const deadline = Date.now() + 30000
      const teacherRevealDeadline = deadline + 5 * 60 * 1000
      const questionHashIPFS = 'QmTest123'
      const symbol = 'MATH101'

      // Create Quiz using helper
      const { tx, effect } = await teacherQuizHelper.createQuiz({
        teacherPubKey,
        initialSupply: initialQuizSupply,
        symbol,
        questionHashIPFS,
        answerHashes,
        prizePool,
        entryFee,
        passThreshold,
        deadline,
        teacherRevealDeadline
      })

      await teacherComputer.broadcast(tx)
      await TestHelper.waitForMempool()

      quiz = effect.res
      quizId = quiz._id

      // Mine block to confirm quiz creation
      await TestHelper.mineBlocks(teacherComputer, 1)

      const teacherBalanceAfter = (await TestHelper.getBalance(teacherComputer)).balance

      console.log(`    ✅ Quiz fungible token created: ${quizId.substring(0, 20)}...`)
      console.log(`    ✅ Symbol: ${quiz.symbol}`)
      console.log(`    ✅ Template amount: ${quiz.amount} (mint() creates new tokens on-demand)`)
      console.log(`    ✅ Status: ${quiz.status}`)
      console.log(`    ✅ Entry fee (metadata): ${quiz.entryFee.toLocaleString()} sats`)
      console.log(`    ✅ Prize pool (metadata): ${quiz.prizePool.toLocaleString()} sats`)

      TestHelper.displayBalanceChange('Teacher Balance', teacherBalanceBefore, teacherBalanceAfter)

      expect(quiz.amount).to.equal(initialQuizSupply)
      expect(quiz.symbol).to.equal(symbol)
      expect(quiz.status).to.equal('active')
      expect(quiz.prizePool).to.equal(prizePool)
      expect(quiz.entryFee).to.equal(entryFee)
      expect(quiz.teacher).to.equal(teacherPubKey)
    })

    it('should allow student 1 to purchase quiz token via exec (TBC20)', async function () {
      console.log('\n  💰 Student 1 purchasing Quiz token via EXEC...')

      const student1BalanceBefore = (await TestHelper.getBalance(student1Computer)).balance
      const teacherBalanceBefore = (await TestHelper.getBalance(teacherComputer)).balance

      console.log(`\n    📊 Before purchase:`)
      console.log(`      Teacher's Quiz template amount: ${quiz.amount} (will stay same after mint)`)

      // STEP 1: Teacher creates mock payment and partially signed exec transaction
      console.log('\n    📝 Step 1: Teacher creating partially signed exec transaction...')

      const paymentMock = new PaymentMock(entryFee, teacherPubKey, 'Entry Fee', quizId)
      console.log(`      ✅ Mock payment created`)

      const { tx: partialExecTx } = await teacherAccessHelper.createQuizAccessTx(
        quiz,
        paymentMock,
        SIGHASH_SINGLE | SIGHASH_ANYONECANPAY
      )

      console.log(`      ✅ Teacher partially signed exec transaction`)

      // STEP 2: Student creates real entry fee Payment
      console.log('\n    💰 Step 2: Student creating real entry fee payment...')

      const { tx: paymentTx, effect: paymentEffect } = await student1PaymentHelper.createPayment({
        recipient: teacherPubKey,
        amount: entryFee,
        purpose: 'Entry Fee',
        reference: quizId
      })

      await student1Computer.broadcast(paymentTx)
      await TestHelper.waitForMempool()

      const entryPayment = paymentEffect.res

      console.log(`      ✅ Entry fee payment created: ${entryPayment._id.substring(0, 20)}...`)

      // STEP 3: Student updates transaction inputs/outputs and broadcasts
      console.log('\n    🔗 Step 3: Student updating transaction with real payment...')

      const [paymentTxId, paymentIndex] = entryPayment._rev.split(':')
      partialExecTx.updateInput(1, { txId: paymentTxId, index: parseInt(paymentIndex, 10) })
      partialExecTx.updateOutput(1, { scriptPubKey: student1Computer.toScriptPubKey() })

      await student1Computer.fund(partialExecTx)
      await student1Computer.sign(partialExecTx)
      await student1Computer.broadcast(partialExecTx)
      await TestHelper.waitForMempool()

      // Mine block to confirm purchase
      await TestHelper.mineBlocks(student1Computer, 1)

      // Query for student's quiz token
      const [studentQuizRev] = await student1Computer.query({ publicKey: student1PubKey })
      student1Quiz = await student1Computer.sync(studentQuizRev)

      const student1BalanceAfter = (await TestHelper.getBalance(student1Computer)).balance
      const teacherBalanceAfter = (await TestHelper.getBalance(teacherComputer)).balance

      console.log(`\n    📊 After purchase:`)
      console.log(`      Student received quiz token: ${student1Quiz._id.substring(0, 20)}...`)
      console.log(`      Student quiz amount: ${student1Quiz.amount} (freshly minted via mint())`)
      console.log(`      Teacher's template amount: ${quiz.amount} (unchanged - template preserved)`)

      TestHelper.displayBalanceChange('Student 1 Balance', student1BalanceBefore, student1BalanceAfter)
      TestHelper.displayBalanceChange('Teacher Balance', teacherBalanceBefore, teacherBalanceAfter)

      expect(quiz.amount).to.equal(BigInt(1))
      expect(student1Quiz.amount).to.equal(BigInt(1))
      expect(student1Quiz._owners[0]).to.equal(student1PubKey)
    })

    it('should allow student to redeem quiz token and submit answers', async function () {
      console.log('\n  📝 Student 1 redeeming quiz token and creating attempt...')

      const student1BalanceBefore = (await TestHelper.getBalance(student1Computer)).balance

      const correctQuizId = student1Quiz.originalQuizId || student1Quiz._id

      // STEP 1: Create QuizAttempt
      console.log(`\n    📝 Step 1: Creating QuizAttempt...`)

      const { tx: attemptTx, effect: attemptEffect } = await student1AttemptHelper.createQuizAttempt({
        studentPubKey: student1PubKey,
        quizId: correctQuizId,
        answerCommitment: '',
        entryFee,
        teacher: student1Quiz.teacher
      })

      await student1Computer.broadcast(attemptTx)
      await TestHelper.waitForMempool()

      const tempAttempt = attemptEffect.res

      console.log(`      ✅ QuizAttempt created`)

      // STEP 2: Redeem quiz token
      console.log(`\n    🔥 Step 2: Redeeming Quiz token (burning it)...`)

      const [latestQuizTokenRev] = await student1Computer.query({ ids: [student1Quiz._id] })
      const syncedQuizToken = await student1Computer.sync(latestQuizTokenRev)

      const [latestAttemptRev] = await student1Computer.query({ ids: [tempAttempt._id] })
      const syncedAttempt = await student1Computer.sync(latestAttemptRev)

      const { tx: redeemTx, effect: redeemEffect } = await student1RedemptionHelper.redeemQuizToken(
        syncedQuizToken,
        syncedAttempt
      )

      await student1Computer.broadcast(redeemTx)
      await TestHelper.waitForMempool()

      const [burnedToken, validatedAttempt] = redeemEffect.res
      attempt1 = validatedAttempt

      // Mine block to confirm redemption
      await TestHelper.mineBlocks(student1Computer, 1)

      const [burnedTokenRev] = await student1Computer.query({ ids: [student1Quiz._id] })
      const finalQuizToken: any = await student1Computer.sync(burnedTokenRev)

      console.log(`\n    📊 After redemption:`)
      console.log(`      Quiz token amount: ${finalQuizToken.amount} (BURNED! ✅)`)
      console.log(`      QuizAttempt status: ${attempt1.status}`)
      console.log(`      QuizAttempt isRedeemed: ${attempt1.isRedeemed}`)

      expect(finalQuizToken.amount).to.equal(BigInt(0))
      expect(attempt1.status).to.equal('owned')
      expect(attempt1.isRedeemed).to.be.true
      expect(attempt1._owners[0]).to.equal(student1PubKey)
    })

    it('should allow student 1 to submit answers after redemption', async function () {
      console.log('\n  ✍️ Student 1 submitting answers...')

      commitment1 = QuizCrypto.hashCommitment(student1Answers, QuizCrypto.generateSalt())

      const { tx: commitTx } = await student1AttemptHelper.submitCommitment(
        attempt1,
        commitment1
      )

      await student1Computer.broadcast(commitTx)
      await TestHelper.waitForMempool()

      // Mine to confirm
      await TestHelper.mineBlocks(student1Computer, 1)

      // Query and sync to get updated state
      const [updatedAttemptRev] = await student1Computer.query({ ids: [attempt1._id] })
      attempt1 = await student1Computer.sync(updatedAttemptRev)

      console.log(`    ✅ Answers submitted`)
      console.log(`    ✅ Status: ${attempt1.status}`)

      expect(attempt1.status).to.equal('committed')
      expect(attempt1.answerCommitment).to.equal(commitment1)
    })
  })

  describe('Phase 2: Teacher Reveal & Scoring', () => {
    it('should allow teacher to reveal answers', async function () {
      console.log('\n  🔓 Teacher revealing answers...')

      // Sync latest quiz state
      const [latestQuizRev] = await teacherComputer.query({ ids: [quiz._id] })
      const syncedQuiz = await teacherComputer.sync(latestQuizRev)

      const { tx: revealTx } = await teacherComputer.encodeCall({
        target: syncedQuiz,
        property: 'revealAnswers',
        args: [correctAnswers, salt],
        mod: quizMod
      })

      await teacherComputer.broadcast(revealTx)
      await TestHelper.waitForMempool()

      // Mine to confirm
      await TestHelper.mineBlocks(teacherComputer, 1)

      // Sync to get updated quiz
      const [updatedQuizRev] = await teacherComputer.query({ ids: [quiz._id] })
      quiz = await teacherComputer.sync(updatedQuizRev)

      console.log(`    ✅ Quiz status: ${quiz.status}`)
      console.log(`    ✅ Revealed answers: ${quiz.revealedAnswers.join(', ')}`)

      expect(quiz.status).to.equal('revealed')
      expect(quiz.revealedAnswers).to.deep.equal(correctAnswers)
    })

    it('should verify student attempt', async function () {
      console.log('\n  ✅ Student 1 verifying their attempt...')

      const score1 = QuizScoring.calculateScore(student1Answers, correctAnswers)
      const passed1 = QuizScoring.didPass(score1.percentage, passThreshold)

      // Sync latest attempt
      const [latestAttemptRev] = await student1Computer.query({ ids: [attempt1._id] })
      const syncedAttempt1 = await student1Computer.sync(latestAttemptRev)

      const { tx: verifyTx } = await student1Computer.encodeCall({
        target: syncedAttempt1,
        property: 'verify',
        args: [score1.percentage, passed1],
        mod: attemptMod
      })

      await student1Computer.broadcast(verifyTx)
      await TestHelper.waitForMempool()

      // Mine block to confirm verification
      await TestHelper.mineBlocks(student1Computer, 1)

      const [verifiedRev] = await student1Computer.query({ ids: [attempt1._id] })
      attempt1 = await student1Computer.sync(verifiedRev)

      console.log(`    ✅ Attempt verified: score=${attempt1.score}%, passed=${attempt1.passed}`)

      expect(attempt1.status).to.equal('verified')
      expect(attempt1.passed).to.be.true
      expect(attempt1.score).to.equal(100)
    })
  })

  describe('Phase 3: Prize Distribution (SWAP)', () => {
    it('should allow winner to create AnswerProof', async function () {
      console.log('\n  📜 Winner creating AnswerProof...')

      const { tx: proofTx, effect: proofEffect } = await student1ProofHelper.createAnswerProof({
        student: student1PubKey,
        quizRef: quizId,
        attemptRef: attempt1._id,
        answers: student1Answers,
        score: 100,
        passed: true
      })

      await student1Computer.broadcast(proofTx)
      await TestHelper.waitForMempool()

      answerProof1 = proofEffect.res

      // Mine to confirm
      await TestHelper.mineBlocks(student1Computer, 1)

      console.log(`    ✅ AnswerProof created: ${answerProof1._id.substring(0, 20)}...`)
      console.log(`    ✅ Owned by: Student 1 ✅`)
      console.log(`    ✅ Score: ${answerProof1.score}%, Passed: ${answerProof1.passed}`)

      expect(answerProof1._owners[0]).to.equal(student1PubKey)
      expect(answerProof1.score).to.equal(100)
      expect(answerProof1.passed).to.be.true
    })

    it('should create prize Payment for winner', async function () {
      console.log('\n  💰 Teacher creating prize Payment...')

      const { tx: prizeTx, effect: prizeEffect } = await teacherPaymentHelper.createPayment({
        recipient: student1PubKey,
        amount: prizePool,
        purpose: 'Prize Payment',
        reference: attempt1._id
      })

      await teacherComputer.broadcast(prizeTx)
      await TestHelper.waitForMempool()

      prizePayment1 = prizeEffect.res

      // Mine to confirm
      await TestHelper.mineBlocks(teacherComputer, 1)

      console.log(`    ✅ Prize Payment created: ${prizePayment1._id.substring(0, 20)}...`)
      console.log(`    ✅ Amount: ${prizePayment1.amount.toLocaleString()} sats`)
      console.log(`    ✅ Owned by: Teacher (for now)`)

      expect(prizePayment1._owners[0]).to.equal(teacherPubKey)
      expect(prizePayment1.amount).to.equal(prizePool)
    })

    it('should execute prize swap atomically', async function () {
      console.log('\n  🔄 Executing prize SWAP...')

      const student1BalanceBefore = await TestHelper.getBalance(student1Computer)

      console.log(`\n    📊 Before swap:`)
      console.log(`      Prize Payment owned by: Teacher`)
      console.log(`      Answer Proof owned by: Student`)

      // Step 1: Teacher creates partially signed swap transaction
      console.log(`\n    📝 Step 1: Teacher creating swap transaction...`)

      // Sync latest attempt state to ensure it's verified
      const [attemptRevForSwap] = await teacherComputer.query({ ids: [attempt1._id] })
      const syncedAttempt = await teacherComputer.sync(attemptRevForSwap)

      const { tx: swapTx } = await teacherSwapHelper.createPrizeSwapTx(
        prizePayment1,
        answerProof1,
        syncedAttempt,
        SIGHASH_SINGLE | SIGHASH_ANYONECANPAY
      )

      console.log(`    ✅ Teacher created swap transaction`)

      // Step 2: Student funding, signing and broadcasting
      console.log(`\n    🔐 Step 2: Student funding, signing and broadcasting...`)
      await student1Computer.fund(swapTx)
      await student1Computer.sign(swapTx)
      await student1Computer.broadcast(swapTx)

      await TestHelper.mineBlocks(student1Computer, 1)
      await TestHelper.waitForMempool()

      // Sync all swapped objects
      const [latestPrizeRev] = await student1Computer.query({ ids: [prizePayment1._id] })
      const [latestProofRev] = await teacherComputer.query({ ids: [answerProof1._id] })
      const [latestAttemptRev] = await student1Computer.query({ ids: [attempt1._id] })

      const finalPrize: any = await student1Computer.sync(latestPrizeRev)
      const finalProof: any = await teacherComputer.sync(latestProofRev)
      const finalAttempt: any = await student1Computer.sync(latestAttemptRev)

      console.log(`\n    ✅ Swap completed successfully!`)
      console.log(`    ✅ Prize Payment now owned by: ${finalPrize._owners[0] === student1PubKey ? 'Student 1 ✅' : 'Teacher ❌'}`)
      console.log(`    ✅ Answer Proof now owned by: ${finalProof._owners[0] === teacherPubKey ? 'Teacher ✅' : 'Student ❌'}`)
      console.log(`    ✅ Attempt status: ${finalAttempt.status}`)
      console.log(`    ✅ Prize Payment _satoshis before claim: ${finalPrize._satoshis}`)

      expect(finalPrize._owners[0]).to.equal(student1PubKey)
      expect(finalProof._owners[0]).to.equal(teacherPubKey)
      expect(finalAttempt.status).to.equal('prize_claimed')

      // STEP 3: Student claims the prize Payment to release satoshis back to wallet
      console.log(`\n    💰 Step 3: Student claiming prize (releasing satoshis)...`)

      // Capture balance right before claim to see the effect of just the claim operation
      const student1BalanceBeforeClaim = await TestHelper.getBalance(student1Computer)

      const { tx: claimTx } = await student1PaymentHelper.claimPayment(finalPrize)

      await student1Computer.broadcast(claimTx)
      await TestHelper.waitForMempool()

      await TestHelper.mineBlocks(student1Computer, 1)
      await TestHelper.waitForMempool()

      // Query and sync to get updated prize payment state
      const [claimedPrizeRev] = await student1Computer.query({ ids: [finalPrize._id] })
      const claimedPrize: any = await student1Computer.sync(claimedPrizeRev)

      const student1BalanceAfterClaim = await TestHelper.getBalance(student1Computer)

      console.log(`\n    📊 After claim:`)
      console.log(`      Prize Payment _satoshis: ${claimedPrize._satoshis} (released ${prizePool - claimedPrize._satoshis} sats)`)
      console.log(`      Prize Payment status: ${claimedPrize.status}`)
      console.log(`      Student balance from claim: ${student1BalanceAfterClaim.balance > student1BalanceBeforeClaim.balance ? 'Increased ✅' : 'Decreased ❌'}`)

      TestHelper.displayBalanceChange('Student Balance (claim only)', student1BalanceBeforeClaim.balance, student1BalanceAfterClaim.balance)
      TestHelper.displayBalanceChange('Student Balance (overall swap)', student1BalanceBefore.balance, student1BalanceAfterClaim.balance)

      expect(claimedPrize._satoshis).to.equal(BigInt(546))
      expect(claimedPrize.status).to.equal('claimed')
      // The claim operation itself should release sats back to student (minus claim tx fee)
      // Overall balance might decrease due to swap tx fees, but claim should add value
      expect(student1BalanceAfterClaim.balance > student1BalanceBeforeClaim.balance).to.be.true
    })
  })
})
