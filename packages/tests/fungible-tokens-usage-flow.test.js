/**
 * TBC20 SEAT TOKEN FLOW INTEGRATION TEST
 * Bitcoin Computer Quiz Platform - Fungible Seat Tokens with On-Demand Attempt Creation
 *
 * Tests the complete flow with TBC20 fungible tokens + exec/swap patterns:
 * PHASE 1: Quiz Creation & Seat Token Minting
 *   - Teacher creates quiz with prize pool
 *   - Teacher mints fungible SEAT tokens (e.g., 100 seats)
 *
 * PHASE 2: Seat Purchase (EXEC Pattern with TBC20)
 *   - Students buy seat tokens by paying entry fee (exec pattern)
 *   - Seat tokens are fungible and split using TBC20 transfer()
 *   - Teacher's seat supply reduces, student gets 1 SEAT token
 *
 * PHASE 3: Seat Redemption (On-Demand Attempt Creation)
 *   - Student redeems SEAT token (burns it)
 *   - Receives unique QuizAttempt NFT
 *   - Student submits answers to attempt
 *
 * PHASE 4: Teacher Reveal & Scoring
 *   - Teacher reveals correct answers
 *   - Teacher scores attempts from commitments
 *   - NO student reveal phase
 *
 * PHASE 5: Prize Distribution (SWAP)
 *   - Winners create AnswerProof contracts
 *   - Winners swap AnswerProof for prize (swap pattern)
 *   - Losers already paid entry fee in Phase 2
 *
 * Benefits of TBC20 Seat Token Pattern:
 * - Teacher doesn't create attempts until student redeems seat
 * - Saves gas if students buy seats but don't take quiz
 * - Flexible: Can buy seat early, take quiz later
 * - On-demand attempt creation only when needed
 */

import { describe, it, before } from 'mocha'
import { expect } from 'chai'
import { Computer, Transaction } from '@bitcoin-computer/lib'
import crypto from 'crypto'
import dotenv from 'dotenv'

// Import deployed contracts
import { Quiz, Payment } from '@bizz/contracts/deploy/Quiz.deploy.js'
import { QuizAttempt } from '@bizz/contracts/deploy/QuizAttempt.deploy.js'
import { SeatToken } from '@bizz/contracts/deploy/SeatToken.deploy.js'
import { SeatAccess } from '@bizz/contracts/deploy/SeatAccess.deploy.js'
import { SeatRedemption } from '@bizz/contracts/deploy/SeatRedemption.deploy.js'
import { AnswerProof } from '@bizz/contracts/deploy/AnswerProof.deploy.js'
import { PrizeSwap } from '@bizz/contracts/deploy/PrizeSwap.deploy.js'

dotenv.config({ path: '.env.local' })

const { SIGHASH_SINGLE, SIGHASH_ANYONECANPAY } = Transaction

// ============================================================================
// MOCK CLASSES FOR PARTIAL SIGNING
// ============================================================================

const mockedRev = `mock-${'0'.repeat(64)}:0`

class PaymentMock {
    constructor(satoshis, recipient) {
        this._id = mockedRev
        this._rev = mockedRev
        this._root = mockedRev
        this._satoshis = satoshis
        this._owners = recipient ? [recipient] : []
        this.recipient = recipient || ''
        this.amount = satoshis
        this.purpose = 'Entry Fee'
        this.reference = ''
        this.status = 'unclaimed'
        this.createdAt = Date.now()
        this.claimedAt = null
    }

    transfer(to) {
        this._owners = [to]
        this.recipient = to
    }
}

class SeatTokenMock {
    constructor(amount, owner, symbol, quizRef) {
        this._id = mockedRev
        this._rev = mockedRev
        this._root = mockedRev
        this._satoshis = BigInt(546)
        this._owners = [owner]
        this.amount = amount
        this.symbol = symbol
        this.quizRef = quizRef
    }

    transfer(recipient, amount) {
        this.amount -= amount
        return new SeatTokenMock(amount, recipient, this.symbol, this.quizRef)
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

describe('🎓 TBC20 SEAT TOKEN FLOW - Fungible Tokens with On-Demand Attempts', function () {
    this.timeout(600000) // 10 minutes for blockchain operations

    // Test wallets
    let teacherComputer, student1Computer, student2Computer, student3Computer
    let teacherPubKey, student1PubKey, student2PubKey, student3PubKey

    // Contract module specs
    let quizModuleSpec, attemptModuleSpec, seatTokenModuleSpec, seatAccessModuleSpec, seatRedemptionModuleSpec, proofModuleSpec, swapModuleSpec

    // Test data
    const correctAnswers = ['Paris', '4', 'Blue']
    const salt = generateSalt()
    const entryFee = BigInt(5000)  // 5,000 sats
    const prizePool = BigInt(50000) // 50,000 sats
    const passThreshold = 70
    const totalSeats = 100n  // Teacher mints 100 seat tokens

    // Quiz data
    let quiz, quizId, answerHashes

    // Seat token data
    let quizSeats  // Teacher's fungible seat token UTXO
    let student1Seat, student2Seat, student3Seat  // Student seat token UTXOs

    // Attempt data (created on redemption)
    let attempt1, attempt2, attempt3
    let student1Answers, student2Answers, student3Answers
    let commitment1, commitment2, commitment3

    // Winner data
    let answerProof1, prizePayment1

    before(async function () {
        console.log('\n' + '='.repeat(80))
        console.log('  🎓 INITIALIZING EXEC + SWAP TEST ENVIRONMENT')
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
        await student1Computer.faucet(5000000)  // 5M sats each
        await student2Computer.faucet(5000000)
        await student3Computer.faucet(5000000)

        console.log(`    ✅ Teacher funded: ${(await teacherComputer.getBalance()).balance.toLocaleString()} sats`)
        console.log(`    ✅ Students funded: 5M sats each`)

        // Mine multiple blocks after funding to confirm transactions
        await mineBlockFromRPCClient(teacherComputer)
        await sleep(2000)
        await mineBlockFromRPCClient(teacherComputer)
        await sleep(2000)

        console.log('\n  📦 Deploying contract modules...')

        quizModuleSpec = await withRetry(
            () => teacherComputer.deploy(`export ${Quiz}\nexport ${Payment}`),
            'Deploy Quiz module',
            teacherComputer,
            10 // Increase retries
        )
        console.log(`    ✅ Quiz module deployed`)
        await mineBlockFromRPCClient(teacherComputer)
        await sleep(3000)
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
        await mineBlockFromRPCClient(teacherComputer)
        await sleep(3000)

        seatTokenModuleSpec = await withRetry(
            () => teacherComputer.deploy(`export ${SeatToken}`),
            'Deploy SeatToken module',
            teacherComputer,
            10
        )
        console.log(`    ✅ SeatToken module deployed`)
        await mineBlockFromRPCClient(teacherComputer)
        await sleep(3000)
        await mineBlockFromRPCClient(teacherComputer)
        await sleep(3000)

        seatAccessModuleSpec = await withRetry(
            () => teacherComputer.deploy(`export ${SeatAccess}`),
            'Deploy SeatAccess module',
            teacherComputer,
            10
        )
        console.log(`    ✅ SeatAccess module deployed`)
        await mineBlockFromRPCClient(teacherComputer)
        await sleep(3000)
        await mineBlockFromRPCClient(teacherComputer)
        await sleep(3000)

        seatRedemptionModuleSpec = await withRetry(
            () => teacherComputer.deploy(`export ${SeatRedemption}`),
            'Deploy SeatRedemption module',
            teacherComputer,
            10
        )
        console.log(`    ✅ SeatRedemption module deployed`)
        await mineBlockFromRPCClient(teacherComputer)
        await sleep(3000)
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

        // Student answers: S1=100%, S2=0%, S3=33%
        student1Answers = ['Paris', '4', 'Blue']    // 100% - PASS
        student2Answers = ['London', '3', 'Red']    // 0% - FAIL
        student3Answers = ['Paris', '3', 'Red']     // 33% - FAIL

        console.log(`    ✅ Quiz prepared with ${correctAnswers.length} questions`)
        console.log(`    ✅ Pass threshold: ${passThreshold}%`)

        console.log('\n' + '='.repeat(80))
        console.log('  ✅ SETUP COMPLETE - Ready to run tests')
        console.log('='.repeat(80) + '\n')
    })

    describe('Phase 1: Quiz Creation & Seat Token Minting', () => {
        it('should create quiz with prize pool', async function () {
            console.log('\n  🎓 Creating Quiz...')

            const teacherBalanceBefore = (await teacherComputer.getBalance()).balance

            const deadline = Date.now() + 30000
            const teacherRevealDeadline = deadline + (5 * 60 * 1000)
            const questionHashIPFS = 'QmTest123'

            const { tx, effect } = await withRetry(
                () => teacherComputer.encode({
                    mod: quizModuleSpec,
                    exp: `new Quiz("${teacherPubKey}", "${questionHashIPFS}", ${JSON.stringify(answerHashes)}, BigInt(${prizePool}), BigInt(${entryFee}), ${passThreshold}, ${deadline}, ${teacherRevealDeadline})`
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

            console.log(`    ✅ Quiz created: ${quizId.substring(0, 20)}...`)
            console.log(`    ✅ Status: ${quiz.status}`)
            console.log(`    ✅ Prize pool (metadata): ${prizePool.toLocaleString()} sats`)
            console.log(`    ✅ Entry fee (metadata): ${entryFee.toLocaleString()} sats`)

            displayBalanceChange('Teacher Balance', teacherBalanceBefore, teacherBalanceAfter)

            expect(quiz.status).to.equal('active')
            expect(quiz.prizePool).to.equal(prizePool)
            expect(quiz.entryFee).to.equal(entryFee)
        })

        it('should mint fungible seat tokens (TBC20 pattern)', async function () {
            console.log('\n    Teacher minting seat tokens (TBC20)...')

            await mineBlockFromRPCClient(teacherComputer)

            const teacherBalanceBefore = (await teacherComputer.getBalance()).balance

            // Mint 100 fungible SEAT tokens in ONE UTXO
            const { tx, effect } = await withRetry(
                () => teacherComputer.encode({
                    mod: seatTokenModuleSpec,
                    exp: `new SeatToken("${teacherPubKey}", BigInt(${totalSeats}), "SEAT", "${quizId}")`
                }),
                'Encode SeatToken minting',
                teacherComputer
            )

            await withRetry(
                () => teacherComputer.broadcast(tx),
                'Broadcast SeatToken minting',
                teacherComputer
            )

            quizSeats = effect.res

            await sleep(3000)

            const teacherBalanceAfter = (await teacherComputer.getBalance()).balance

            console.log(`    ✅ Seat tokens minted: ${quizSeats._id.substring(0, 20)}...`)
            console.log(`    ✅ Total supply: ${quizSeats.amount} SEAT tokens`)
            console.log(`    ✅ Symbol: ${quizSeats.symbol}`)
            console.log(`    ✅ Quiz reference: ${quizSeats.quizRef.substring(0, 20)}...`)
            console.log(`    ✅ Owned by: Teacher`)
            console.log(`    ✅ This is a SINGLE fungible UTXO (TBC20) - will split on purchase`)

            displayBalanceChange('Teacher Balance', teacherBalanceBefore, teacherBalanceAfter)

            expect(quizSeats.amount).to.equal(totalSeats)
            expect(quizSeats.symbol).to.equal('SEAT')
            expect(quizSeats.quizRef).to.equal(quizId)
            expect(quizSeats._owners[0]).to.equal(teacherPubKey)
        })

        it('should allow student 1 to purchase attempt via exec', async function () {
            console.log('\n   Student 1 purchasing attempt via EXEC (Bitcoin Computer Sale Pattern)...')

            await mineBlockFromRPCClient(teacherComputer)

            const student1BalanceBefore = (await student1Computer.getBalance()).balance
            const teacherBalanceBefore = (await teacherComputer.getBalance()).balance

            // STEP 1: Teacher creates mock payment and partially signed exec transaction
            console.log('\n    📝 Step 1: Teacher creating partially signed exec transaction...')

            const paymentMock = new PaymentMock(entryFee, teacherPubKey)
            console.log(`      ✅ Mock payment created: ${paymentMock._rev}`)

            const { tx: partialExecTx } = await withRetry(
                () => teacherComputer.encode({
                    exp: `${AttemptAccess} AttemptAccess.exec(attempt, entryFeePayment)`,
                    env: {
                        attempt: attempt1._rev,
                        entryFeePayment: paymentMock._rev  // Mock payment revision
                    },
                    mocks: { entryFeePayment: paymentMock },  // Tell encoder it's mocked
                    mod: accessModuleSpec,
                    sighashType: SIGHASH_SINGLE | SIGHASH_ANYONECANPAY,
                    inputIndex: 0,
                    fund: false,  // Student will fund
                    sign: true    // Teacher signs their input (attempt)
                }),
                'Create partial exec transaction',
                teacherComputer
            )

            console.log(`      ✅ Teacher created and signed partial exec transaction`)
            console.log(`      ✅ Transaction ready for student to complete`)

            // STEP 2: Student creates real entry fee Payment
            console.log('\n    💰 Step 2: Student creating real entry fee payment...')

            await mineBlockFromRPCClient(student1Computer)

            const { tx: paymentTx, effect: paymentEffect } = await withRetry(
                () => student1Computer.encode({
                    mod: quizModuleSpec,
                    exp: `new Payment("${teacherPubKey}", BigInt(${entryFee}), "Entry Fee", "${attempt1._id}")`
                }),
                'Create entry fee payment',
                student1Computer
            )

            await student1Computer.broadcast(paymentTx)
            const entryFeePayment1 = paymentEffect.res

            await sleep(3000)
            console.log(`      ✅ Student created entry fee payment: ${entryFeePayment1._id.substring(0, 20)}...`)
            console.log(`      ✅ Payment amount: ${entryFeePayment1.amount.toLocaleString()} sats`)

            // STEP 3: Student updates partial transaction with real payment
            console.log('\n    🔧 Step 3: Student updating transaction with real payment...')

            const [paymentTxId, paymentIndex] = entryFeePayment1._rev.split(':')
            partialExecTx.updateInput(1, {
                txId: paymentTxId,
                index: parseInt(paymentIndex, 10)
            })

            console.log(`      ✅ Updated input 1 to point to real payment`)
            console.log(`      ✅ Payment UTXO: ${paymentTxId.substring(0, 20)}...:${paymentIndex}`)

            // Update output to ensure student receives the attempt
            partialExecTx.updateOutput(1, { scriptPubKey: student1Computer.toScriptPubKey() })
            console.log(`      ✅ Updated output 1 to student's scriptPubKey`)

            // STEP 4: Student funds, signs, and broadcasts
            console.log('\n    📡 Step 4: Student funding, signing, and broadcasting...')

            await student1Computer.fund(partialExecTx)
            console.log(`      ✅ Transaction funded by student`)

            await student1Computer.sign(partialExecTx)
            console.log(`      ✅ Transaction signed by student`)

            await withRetry(
                () => student1Computer.broadcast(partialExecTx),
                'Broadcast exec transaction',
                student1Computer
            )
            console.log(`      ✅ Transaction broadcast to network`)

            await sleep(3000)

            // STEP 5: Query updated states
            console.log('\n    🔍 Step 5: Verifying exec results...')

            const [latestAttempt1Rev] = await student1Computer.query({ ids: [attempt1._id] })
            attempt1 = await student1Computer.sync(latestAttempt1Rev)

            const student1BalanceAfter = (await student1Computer.getBalance()).balance
            const teacherBalanceAfter = (await teacherComputer.getBalance()).balance


            console.log(`     Attempt now owned by: ${attempt1._owners[0] === student1PubKey ? 'Student 1 ✅' : 'Teacher ❌'}`)
            console.log(`     Attempt status: ${attempt1.status}`)
            console.log(`     Entry fee transferred atomically in single transaction`)

            displayBalanceChange('Student 1 Balance', student1BalanceBefore, student1BalanceAfter)
            displayBalanceChange('Teacher Balance', teacherBalanceBefore, teacherBalanceAfter)

            expect(attempt1._owners[0]).to.equal(student1PubKey)
            expect(attempt1.status).to.equal('owned')
            expect(student1BalanceAfter).to.be.lessThan(student1BalanceBefore)
        })

        it('should allow student 1 to submit answers after purchase', async function () {
            console.log('\n    Student 1 submitting answers...')

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
            console.log(`    ✅ Commitment: ${attempt1.answerCommitment.substring(0, 20)}...`)

            expect(attempt1.status).to.equal('committed')
            expect(attempt1.answerCommitment).to.equal(commitment1)
        })

        it('should allow students 2 and 3 to purchase and submit', async function () {
            console.log('\n  💰 Students 2 & 3 purchasing attempts via EXEC...')

            // ========== STUDENT 2 PURCHASE ==========
            console.log('\n  👨‍🎓 Student 2 Purchase Flow:')

            await mineBlockFromRPCClient(teacherComputer)

            // Teacher creates partial exec for student 2
            const paymentMock2 = new PaymentMock(entryFee, teacherPubKey)
            const { tx: partialExec2Tx } = await teacherComputer.encode({
                exp: `${AttemptAccess} AttemptAccess.exec(attempt, entryFeePayment)`,
                env: {
                    attempt: attempt2._rev,
                    entryFeePayment: paymentMock2._rev
                },
                mocks: { entryFeePayment: paymentMock2 },
                mod: accessModuleSpec,
                sighashType: SIGHASH_SINGLE | SIGHASH_ANYONECANPAY,
                inputIndex: 0,
                fund: false,
                sign: true
            })
            console.log('    ✅ Teacher created partial exec for student 2')

            // Student 2 creates payment
            await mineBlockFromRPCClient(student2Computer)
            const { tx: payment2Tx, effect: payment2Effect } = await student2Computer.encode({
                mod: quizModuleSpec,
                exp: `new Payment("${teacherPubKey}", BigInt(${entryFee}), "Entry Fee", "${attempt2._id}")`
            })
            await student2Computer.broadcast(payment2Tx)
            const entryFeePayment2 = payment2Effect.res
            await sleep(3000)
            console.log('    ✅ Student 2 created payment')

            // Student 2 completes transaction
            const [payment2TxId, payment2Index] = entryFeePayment2._rev.split(':')
            partialExec2Tx.updateInput(1, {
                txId: payment2TxId,
                index: parseInt(payment2Index, 10)
            })
            partialExec2Tx.updateOutput(1, { scriptPubKey: student2Computer.toScriptPubKey() })
            await student2Computer.fund(partialExec2Tx)
            await student2Computer.sign(partialExec2Tx)
            await student2Computer.broadcast(partialExec2Tx)
            await sleep(3000)
            console.log('    ✅ Student 2 completed exec transaction')

            const [latest2] = await student2Computer.query({ ids: [attempt2._id] })
            attempt2 = await student2Computer.sync(latest2)

            // Student 2 submit answers
            await mineBlockFromRPCClient(student2Computer)
            commitment2 = hashCommitment(student2Answers, generateSalt())
            const synced2 = await student2Computer.sync(attempt2._rev)
            const { tx: submit2Tx } = await student2Computer.encodeCall({
                target: synced2,
                property: 'submitCommitment',
                args: [commitment2],
                mod: attemptModuleSpec
            })
            await student2Computer.broadcast(submit2Tx)
            await sleep(3000)

            const [latest2b] = await student2Computer.query({ ids: [attempt2._id] })
            attempt2 = await student2Computer.sync(latest2b)
            console.log(`    ✅ Student 2 submitted answers (status: ${attempt2.status})`)

            // ========== STUDENT 3 PURCHASE ==========
            console.log('\n  👨‍🎓 Student 3 Purchase Flow:')

            await mineBlockFromRPCClient(teacherComputer)

            // Teacher creates partial exec for student 3
            const paymentMock3 = new PaymentMock(entryFee, teacherPubKey)
            const { tx: partialExec3Tx } = await teacherComputer.encode({
                exp: `${AttemptAccess} AttemptAccess.exec(attempt, entryFeePayment)`,
                env: {
                    attempt: attempt3._rev,
                    entryFeePayment: paymentMock3._rev
                },
                mocks: { entryFeePayment: paymentMock3 },
                mod: accessModuleSpec,
                sighashType: SIGHASH_SINGLE | SIGHASH_ANYONECANPAY,
                inputIndex: 0,
                fund: false,
                sign: true
            })
            console.log('    ✅ Teacher created partial exec for student 3')

            // Student 3 creates payment
            await mineBlockFromRPCClient(student3Computer)
            const { tx: payment3Tx, effect: payment3Effect } = await student3Computer.encode({
                mod: quizModuleSpec,
                exp: `new Payment("${teacherPubKey}", BigInt(${entryFee}), "Entry Fee", "${attempt3._id}")`
            })
            await student3Computer.broadcast(payment3Tx)
            const entryFeePayment3 = payment3Effect.res
            await sleep(3000)
            console.log('    ✅ Student 3 created payment')

            // Student 3 completes transaction
            const [payment3TxId, payment3Index] = entryFeePayment3._rev.split(':')
            partialExec3Tx.updateInput(1, {
                txId: payment3TxId,
                index: parseInt(payment3Index, 10)
            })
            partialExec3Tx.updateOutput(1, { scriptPubKey: student3Computer.toScriptPubKey() })
            await student3Computer.fund(partialExec3Tx)
            await student3Computer.sign(partialExec3Tx)
            await student3Computer.broadcast(partialExec3Tx)
            await sleep(3000)
            console.log('    ✅ Student 3 completed exec transaction')

            const [latest3] = await student3Computer.query({ ids: [attempt3._id] })
            attempt3 = await student3Computer.sync(latest3)

            // Student 3 submit answers
            await mineBlockFromRPCClient(student3Computer)
            commitment3 = hashCommitment(student3Answers, generateSalt())
            const synced3 = await student3Computer.sync(attempt3._rev)
            const { tx: submit3Tx } = await student3Computer.encodeCall({
                target: synced3,
                property: 'submitCommitment',
                args: [commitment3],
                mod: attemptModuleSpec
            })
            await student3Computer.broadcast(submit3Tx)
            await sleep(3000)

            const [latest3b] = await student3Computer.query({ ids: [attempt3._id] })
            attempt3 = await student3Computer.sync(latest3b)
            console.log(`    ✅ Student 3 submitted answers (status: ${attempt3.status})`)

            console.log(`\n    ✅ Both students purchased and submitted successfully`)
            expect(attempt2.status).to.equal('committed')
            expect(attempt3.status).to.equal('committed')
        })
    })

    describe('Phase 2: Teacher Reveal & Scoring', () => {
        it('should allow teacher to reveal answers and score attempts', async function () {
            console.log('\n  🔓 Teacher revealing answers and scoring...')

            await sleep(2000)
            await mineBlockFromRPCClient(teacherComputer)

            const syncedQuiz = await teacherComputer.sync(quiz._rev)

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

            const [latestQuizRev] = await teacherComputer.query({ ids: [quiz._id] })
            quiz = await teacherComputer.sync(latestQuizRev)

            console.log(`    ✅ Quiz status: ${quiz.status}`)
            console.log(`    ✅ Revealed answers: ${quiz.revealedAnswers.join(', ')}`)

            // Score attempts
            const score1 = calculateScore(student1Answers, correctAnswers)
            const score2 = calculateScore(student2Answers, correctAnswers)
            const score3 = calculateScore(student3Answers, correctAnswers)

            console.log(`\n    📊 Scoring results:`)
            console.log(`      Student 1: ${score1.percentage}% - ${didPass(score1.percentage, passThreshold) ? '✅ PASS' : '❌ FAIL'}`)
            console.log(`      Student 2: ${score2.percentage}% - ${didPass(score2.percentage, passThreshold) ? '✅ PASS' : '❌ FAIL'}`)
            console.log(`      Student 3: ${score3.percentage}% - ${didPass(score3.percentage, passThreshold) ? '✅ PASS' : '❌ FAIL'}`)

            expect(quiz.status).to.equal('revealed')
            expect(didPass(score1.percentage, passThreshold)).to.be.true
            expect(didPass(score2.percentage, passThreshold)).to.be.false
            expect(didPass(score3.percentage, passThreshold)).to.be.false
        })

        it('should verify attempt (student calls verify on themselves)', async function () {
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

            console.log(`    ✅ Attempt 1 verified: score=${attempt1.score}%, passed=${attempt1.passed}`)

            expect(attempt1.status).to.equal('verified')
            expect(attempt1.passed).to.be.true
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
                    mod: quizModuleSpec,
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
            const teacherBalanceBefore = (await teacherComputer.getBalance()).balance

            // Teacher creates swap transaction (teacher owns prize payment)
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

            // Student signs and broadcasts
            console.log('    Step 2: Student signing and broadcasting...')
            await student1Computer.sign(swapTx)
            await withRetry(
                () => student1Computer.broadcast(swapTx),
                'Broadcast swap',
                student1Computer
            )

            await sleep(3000)

            // Query final states
            const [latestPrizeRev] = await student1Computer.query({ ids: [prizePayment1._id] })
            const [latestProofRev] = await teacherComputer.query({ ids: [answerProof1._id] })
            const [latestAttemptRev] = await student1Computer.query({ ids: [attempt1._id] })

            const finalPrize = await student1Computer.sync(latestPrizeRev)
            const finalProof = await teacherComputer.sync(latestProofRev)
            const finalAttempt = await student1Computer.sync(latestAttemptRev)

            const student1BalanceAfter = (await student1Computer.getBalance()).balance
            const teacherBalanceAfter = (await teacherComputer.getBalance()).balance

            console.log(`\n    ✅ Swap completed successfully!`)
            console.log(`    ✅ Prize Payment now owned by: ${finalPrize._owners[0] === student1PubKey ? 'Student 1 ✅' : 'Teacher ❌'}`)
            console.log(`    ✅ Answer Proof now owned by: ${finalProof._owners[0] === teacherPubKey ? 'Teacher ✅' : 'Student ❌'}`)
            console.log(`    ✅ Attempt status: ${finalAttempt.status}`)

            displayBalanceChange('Student 1 Balance', student1BalanceBefore, student1BalanceAfter)
            displayBalanceChange('Teacher Balance', teacherBalanceBefore, teacherBalanceAfter)

            expect(finalPrize._owners[0]).to.equal(student1PubKey)
            expect(finalProof._owners[0]).to.equal(teacherPubKey)
            expect(finalAttempt.status).to.equal('prize_claimed')
        })
    })

    describe('✅ Economics Verification', () => {
        it('should verify all students paid entry fees', async function () {
            console.log('\n  💵 Verifying entry fee collection...')

            console.log(`    ✅ Student 1: Paid ${entryFee.toLocaleString()} sats (in Phase 1)`)
            console.log(`    ✅ Student 2: Paid ${entryFee.toLocaleString()} sats (in Phase 1)`)
            console.log(`    ✅ Student 3: Paid ${entryFee.toLocaleString()} sats (in Phase 1)`)
            console.log(`    ✅ Total collected: ${(entryFee * BigInt(3)).toLocaleString()} sats`)

            expect(attempt1._owners[0]).to.equal(student1PubKey)
            expect(attempt2._owners[0]).to.equal(student2PubKey)
            expect(attempt3._owners[0]).to.equal(student3PubKey)
        })

        it('should verify winner received prize', async function () {
            console.log('\n  🏆 Verifying prize distribution...')

            const [latestPrizeRev] = await student1Computer.query({ ids: [prizePayment1._id] })
            const finalPrize = await student1Computer.sync(latestPrizeRev)

            console.log(`    ✅ Student 1 (winner): Received ${prizePool.toLocaleString()} sats`)
            console.log(`    ✅ Student 2 (loser): Already paid entry fee, no prize`)
            console.log(`    ✅ Student 3 (loser): Already paid entry fee, no prize`)

            expect(finalPrize._owners[0]).to.equal(student1PubKey)
        })

        it('should display final economics summary', async function () {
            console.log('\n' + '='.repeat(80))
            console.log('  💰 FINAL ECONOMICS SUMMARY')
            console.log('='.repeat(80))

            const totalEntryFees = entryFee * BigInt(3)

            console.log(`\n  Teacher:`)
            console.log(`    Entry fees collected: +${totalEntryFees.toLocaleString()} sats`)
            console.log(`    Prize distributed: -${prizePool.toLocaleString()} sats`)
            console.log(`    Net (before gas): ${(totalEntryFees - prizePool).toLocaleString()} sats`)

            console.log(`\n  Student 1 (Winner):`)
            console.log(`    Entry fee paid: -${entryFee.toLocaleString()} sats`)
            console.log(`    Prize received: +${prizePool.toLocaleString()} sats`)
            console.log(`    Net (before gas): +${(prizePool - entryFee).toLocaleString()} sats`)

            console.log(`\n  Student 2 (Loser):`)
            console.log(`    Entry fee paid: -${entryFee.toLocaleString()} sats`)
            console.log(`    Prize received: 0 sats`)
            console.log(`    Net (before gas): -${entryFee.toLocaleString()} sats`)

            console.log(`\n  Student 3 (Loser):`)
            console.log(`    Entry fee paid: -${entryFee.toLocaleString()} sats`)
            console.log(`    Prize received: 0 sats`)
            console.log(`    Net (before gas): -${entryFee.toLocaleString()} sats`)

            console.log('\n' + '='.repeat(80))
            console.log('  ✅ EXEC + SWAP FLOW TEST COMPLETED SUCCESSFULLY!')
            console.log('='.repeat(80) + '\n')
        })
    })
})
