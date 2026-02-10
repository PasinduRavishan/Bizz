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
  status: string
  createdAt: number
  claimedAt: number | null

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
    this.status = 'unclaimed'
    this.createdAt = Date.now()
    this.claimedAt = null
  }

  transfer(to: string) {
    this._owners = [to]
    this.recipient = to
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

  transfer(to: string) {
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

  // Helper instances (Bitcoin Computer monorepo pattern)
  let quizHelper: QuizHelper
  let paymentHelper: PaymentHelper
  let attemptHelper: QuizAttemptHelper
  let accessHelper: QuizAccessHelper
  let redemptionHelper: QuizRedemptionHelper
  let proofHelper: AnswerProofHelper
  let swapHelper: PrizeSwapHelper

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
    await student1Computer.faucet(5000000) // 5M sats each
    await student2Computer.faucet(5000000)

    const teacherBalance = await TestHelper.getBalance(teacherComputer)
    console.log(`    ✅ Teacher funded: ${teacherBalance.balance.toLocaleString()} sats`)
    console.log(`    ✅ Students funded: 5M sats each`)


    await TestHelper.mineBlocks(teacherComputer, 2)

    console.log('\n  📦 Deploying contract modules with Helper classes...')

    // Initialize and deploy all helpers (Bitcoin Computer monorepo pattern)
    quizHelper = new QuizHelper(teacherComputer)
    await quizHelper.deploy(Token, Quiz)
    await TestHelper.waitForMempool()
    console.log(`    ✅ Token + Quiz module deployed`)

    paymentHelper = new PaymentHelper(teacherComputer)
    await paymentHelper.deploy()
    await TestHelper.waitForMempool()
    console.log(`    ✅ Payment module deployed`)

    attemptHelper = new QuizAttemptHelper(teacherComputer)
    await attemptHelper.deploy()
    await TestHelper.waitForMempool()
    console.log(`    ✅ QuizAttempt module deployed`)

    accessHelper = new QuizAccessHelper(teacherComputer)
    await accessHelper.deploy()
    await TestHelper.waitForMempool()
    console.log(`    ✅ QuizAccess module deployed`)

    redemptionHelper = new QuizRedemptionHelper(teacherComputer)
    await redemptionHelper.deploy()
    await TestHelper.waitForMempool()
    console.log(`    ✅ QuizRedemption module deployed`)

    proofHelper = new AnswerProofHelper(teacherComputer)
    await proofHelper.deploy()
    await TestHelper.waitForMempool()
    console.log(`    ✅ AnswerProof module deployed`)

    swapHelper = new PrizeSwapHelper(teacherComputer)
    await swapHelper.deploy()
    await TestHelper.waitForMempool()
    console.log(`    ✅ PrizeSwap module deployed`)

    // Mine block to confirm all module deployments
    await TestHelper.mineBlocks(teacherComputer, 1)

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
      const { tx, effect } = await quizHelper.createQuiz({
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

      const { tx: partialExecTx } = await accessHelper.createQuizAccessTx(
        quiz,
        paymentMock,
        SIGHASH_SINGLE | SIGHASH_ANYONECANPAY
      )
      await TestHelper.waitForMempool()

      console.log(`      ✅ Teacher partially signed exec transaction`)

      // STEP 2: Student creates real entry fee Payment
      console.log('\n    💰 Step 2: Student creating real entry fee payment...')

      const { tx: paymentTx, effect: paymentEffect } = await paymentHelper.createPayment({
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

      console.log(`\n    📊 After purchase:`)
      console.log(`      Teacher's Quiz template amount: ${quiz.amount} (unchanged ✅)`)
      console.log(`      Student's Quiz token amount: ${student1Quiz.amount}`)
      console.log(`      Student owns quiz token: ${student1Quiz._owners[0] === student1PubKey ? 'Yes ✅' : 'No ❌'}`)

      const student1BalanceAfter = (await TestHelper.getBalance(student1Computer)).balance
      const teacherBalanceAfter = (await TestHelper.getBalance(teacherComputer)).balance

      TestHelper.displayBalanceChange('Student 1 Balance', student1BalanceBefore, student1BalanceAfter)
      TestHelper.displayBalanceChange('Teacher Balance', teacherBalanceBefore, teacherBalanceAfter)

      expect(quiz.amount).to.equal(BigInt(1))
      expect(student1Quiz.amount).to.equal(BigInt(1))
      expect(student1Quiz._owners[0]).to.equal(student1PubKey)
    })

    it('should allow student to redeem quiz token and submit answers', async function () {
      console.log('\n  📝 Student 1 redeeming quiz token and creating attempt...')

      await TestHelper.mineBlocks(student1Computer, 1)

      const correctQuizId = student1Quiz.originalQuizId || student1Quiz._id

      // STEP 1: Create QuizAttempt
      console.log(`\n    📝 Step 1: Creating QuizAttempt...`)

      const { tx: attemptTx, effect: attemptEffect } = await attemptHelper.createQuizAttempt({
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

      const { tx: redeemTx, effect: redeemEffect } = await redemptionHelper.redeemQuizToken(syncedQuizToken, syncedAttempt)
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

      await TestHelper.mineBlocks(student1Computer, 1)


      // Sync latest attempt state
      const [latestAttemptRev] = await student1Computer.query({ ids: [attempt1._id] })
      attempt1 = await student1Computer.sync(latestAttemptRev)
      commitment1 = QuizCrypto.hashCommitment(student1Answers, QuizCrypto.generateSalt())

      const { tx: commitTx, effect: commitEffect } = await attemptHelper.submitCommitment(attempt1, commitment1)
      await student1Computer.broadcast(commitTx)

      attempt1 = commitEffect.res

      console.log(`    ✅ Answers submitted`)
      console.log(`    ✅ Status: ${attempt1.status}`)

      expect(attempt1.status).to.equal('committed')
      expect(attempt1.answerCommitment).to.equal(commitment1)
    })
  })

  describe('Phase 2: Teacher Reveal & Scoring', () => {
    it('should allow teacher to reveal answers', async function () {
      console.log('\n  🔓 Teacher revealing answers...')

      await TestHelper.mineBlocks(teacherComputer, 1)

      const [latestQuizRev] = await teacherComputer.query({ ids: [quiz._id] })
      const syncedQuiz = await teacherComputer.sync(latestQuizRev)

      const { tx: revealTx } = await teacherComputer.encodeCall({
        target: syncedQuiz,
        property: 'revealAnswers',
        args: [correctAnswers, salt],
        mod: quizHelper.mod
      })

      await teacherComputer.broadcast(revealTx)

      await TestHelper.waitForMempool()

      const [revealedQuizRev] = await teacherComputer.query({ ids: [quiz._id] })
      quiz = await teacherComputer.sync(revealedQuizRev)

      console.log(`    ✅ Quiz status: ${quiz.status}`)
      console.log(`    ✅ Revealed answers: ${quiz.revealedAnswers.join(', ')}`)

      expect(quiz.status).to.equal('revealed')
      expect(quiz.revealedAnswers).to.deep.equal(correctAnswers)
    })

    it('should verify student attempt', async function () {
      console.log('\n  ✅ Student 1 verifying their attempt...')

      await TestHelper.mineBlocks(student1Computer, 1)

      const score1 = QuizScoring.calculateScore(student1Answers, correctAnswers)
      const passed1 = QuizScoring.didPass(score1.percentage, passThreshold)

      const syncedAttempt1 = await student1Computer.sync(attempt1._rev)

      const { tx: verifyTx } = await student1Computer.encodeCall({
        target: syncedAttempt1,
        property: 'verify',
        args: [score1.percentage, passed1],
        mod: attemptHelper.mod
      })

      await student1Computer.broadcast(verifyTx)
      await TestHelper.waitForMempool()

      // Mine block to confirm verification
      await TestHelper.mineBlocks(student1Computer, 1)

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

      await TestHelper.mineBlocks(student1Computer, 1)

      const { tx: proofTx, effect: proofEffect } = await proofHelper.createAnswerProof({
        student: student1PubKey,
        quizRef: quizId,
        attemptRef: attempt1._id,
        answers: student1Answers,
        score: attempt1.score,
        passed: attempt1.passed
      })
      await student1Computer.broadcast(proofTx)
      await TestHelper.waitForMempool()

      answerProof1 = proofEffect.res

      console.log(`    ✅ AnswerProof created: ${answerProof1._id.substring(0, 20)}...`)
      console.log(`    ✅ Owned by: ${answerProof1._owners[0] === student1PubKey ? 'Student 1 ✅' : 'Wrong owner ❌'}`)
      console.log(`    ✅ Score: ${answerProof1.score}%, Passed: ${answerProof1.passed}`)

      expect(answerProof1._owners[0]).to.equal(student1PubKey)
      expect(answerProof1.passed).to.be.true
    })

    it('should create prize Payment for winner', async function () {
      console.log('\n  💰 Teacher creating prize Payment...')

      await TestHelper.mineBlocks(teacherComputer, 1)

      const { tx: prizeTx, effect: prizeEffect } = await paymentHelper.createPayment({
        recipient: student1PubKey,
        amount: prizePool,
        purpose: 'Quiz Prize',
        reference: attempt1._id
      })
      await teacherComputer.broadcast(prizeTx)
      await TestHelper.waitForMempool()

      prizePayment1 = prizeEffect.res

      console.log(`    ✅ Prize Payment created: ${prizePayment1._id.substring(0, 20)}...`)
      console.log(`    ✅ Amount: ${prizePayment1.amount.toLocaleString()} sats`)
      console.log(`    ✅ Owned by: Teacher (for now)`)

      expect(prizePayment1._owners[0]).to.equal(teacherPubKey)
      expect(prizePayment1.amount).to.equal(prizePool)
    })

    it('should execute prize swap atomically', async function () {
      console.log('\n  🔄 Executing prize SWAP...')

      await TestHelper.mineBlocks(teacherComputer, 1)

      const student1BalanceBefore = await TestHelper.getBalance(student1Computer)

      console.log(`\n    📊 Before swap:`)
      console.log(`      Prize Payment owned by: Teacher`)
      console.log(`      Answer Proof owned by: Student`)

      // Step 1: Teacher creates partially signed swap transaction
      console.log(`\n    📝 Step 1: Teacher creating swap transaction...`)

      // Sync latest attempt state to ensure it's verified
      const [attemptRevForSwap] = await teacherComputer.query({ ids: [attempt1._id] })
      const syncedAttempt = await teacherComputer.sync(attemptRevForSwap)

      const { tx: swapTx } = await swapHelper.createPrizeSwapTx(
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

      await TestHelper.mineBlocks(student1Computer, 1)

      // Capture balance right before claim to see the effect of just the claim operation
      const student1BalanceBeforeClaim = await TestHelper.getBalance(student1Computer)

      const { tx: claimTx, effect: claimEffect } = await paymentHelper.claimPayment(finalPrize)
      await student1Computer.broadcast(claimTx)

      await TestHelper.mineBlocks(student1Computer, 1)
      await TestHelper.waitForMempool()

      const student1BalanceAfterClaim = await TestHelper.getBalance(student1Computer)

      const claimedPrize = claimEffect.res

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
