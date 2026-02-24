"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrizeService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const lib_1 = require("@bitcoin-computer/lib");
const computer_manager_1 = require("../../common/computer-manager");
const { SIGHASH_SINGLE, SIGHASH_ANYONECANPAY } = lib_1.Transaction;
let PrizeService = class PrizeService {
    prisma;
    constructor() {
        this.prisma = new client_1.PrismaClient();
    }
    async mineBlocks(computer, count = 1) {
        try {
            const newAddress = await computer.rpcCall('getnewaddress', 'mywallet legacy');
            console.log(`  ⛏️  Mining ${count} block(s)...`);
            await computer.rpcCall('generatetoaddress', `${count} ${newAddress.result}`);
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        catch (error) {
            console.error('  ❌ Error mining blocks:', error.message);
        }
    }
    async createAnswerProof(studentId, dto) {
        const attempt = await this.prisma.quizAttempt.findUnique({
            where: { id: dto.attemptId },
            include: {
                student: {
                    select: {
                        id: true,
                        encryptedMnemonic: true,
                        publicKey: true,
                    },
                },
                quiz: {
                    select: {
                        id: true,
                        contractId: true,
                        teacherId: true,
                        questions: true,
                        passThreshold: true,
                    },
                },
            },
        });
        if (!attempt)
            throw new common_1.NotFoundException('Quiz attempt not found');
        if (attempt.userId !== studentId)
            throw new common_1.ForbiddenException('Not your attempt');
        if (attempt.status !== 'VERIFIED') {
            throw new common_1.BadRequestException(`Attempt is ${attempt.status}, must be VERIFIED to create AnswerProof`);
        }
        if (!attempt.passed) {
            throw new common_1.BadRequestException('Only passing attempts can create AnswerProof');
        }
        let answers;
        try {
            const commitment = attempt.answerCommitment;
            if (!commitment)
                throw new Error('No answer commitment stored on this attempt');
            const match = commitment.match(/commitment-(\[[\d,\s]+\])-/);
            if (!match)
                throw new Error(`Cannot parse commitment format: ${commitment.substring(0, 60)}`);
            const studentIndices = JSON.parse(match[1]);
            const questions = attempt.quiz.questions;
            if (!questions || questions.length === 0) {
                answers = studentIndices.map(idx => String(idx));
                console.warn('  ⚠️  No questions stored in DB — using index strings as answer proof');
            }
            else {
                answers = studentIndices.map((idx, i) => {
                    const q = questions[i];
                    return (q && q.options && q.options[idx] !== undefined) ? q.options[idx] : String(idx);
                });
            }
            console.log(`  📝 Reconstructed answers: ${JSON.stringify(answers)}`);
        }
        catch (e) {
            throw new common_1.BadRequestException(`Cannot reconstruct answers from commitment: ${e.message}`);
        }
        const score = attempt.score ?? 0;
        const passed = attempt.passed ?? false;
        try {
            const studentComputer = computer_manager_1.computerManager.getComputer(attempt.student.encryptedMnemonic);
            console.log('📜 Creating AnswerProof...');
            const AnswerProofHelper = (await import('@bizz/contracts/deploy/AnswerProof.deploy.js')).AnswerProofHelper;
            const proofHelper = new AnswerProofHelper(studentComputer, process.env.ANSWER_PROOF_MODULE_ID);
            const { tx: proofTx, effect: proofEffect } = await proofHelper.createAnswerProof({
                student: attempt.student.publicKey,
                quizRef: attempt.quiz.contractId,
                attemptRef: attempt.contractId,
                answers,
                score,
                passed,
            });
            await studentComputer.broadcast(proofTx);
            await new Promise(resolve => setTimeout(resolve, 200));
            const answerProof = proofEffect.res;
            await this.mineBlocks(studentComputer, 1);
            console.log(`✅ AnswerProof created: ${answerProof._id}`);
            console.log(`✅ Score: ${answerProof.score}%, Passed: ${answerProof.passed}`);
            await this.prisma.quizAttempt.update({
                where: { id: dto.attemptId },
                data: {
                    answerProofId: answerProof._id,
                },
            });
            return {
                message: 'AnswerProof created successfully',
                answerProofId: answerProof._id,
                score,
                passed,
            };
        }
        catch (error) {
            console.error('Error creating AnswerProof:', error);
            throw new common_1.BadRequestException(`Failed to create AnswerProof: ${error.message}`);
        }
    }
    async createPrizePayment(teacherId, attemptId) {
        const attempt = await this.prisma.quizAttempt.findUnique({
            where: { id: attemptId },
            include: {
                student: {
                    select: {
                        id: true,
                        publicKey: true,
                    },
                },
                quiz: {
                    select: {
                        id: true,
                        teacherId: true,
                        prizePool: true,
                        prizePerWinner: true,
                        winnerCount: true,
                    },
                },
            },
        });
        if (!attempt)
            throw new common_1.NotFoundException('Quiz attempt not found');
        if (attempt.quiz.teacherId !== teacherId)
            throw new common_1.ForbiddenException('Not your quiz');
        if (attempt.status !== 'VERIFIED') {
            throw new common_1.BadRequestException(`Attempt is ${attempt.status}, must be VERIFIED`);
        }
        if (!attempt.passed) {
            throw new common_1.BadRequestException('Student did not pass');
        }
        if (!attempt.answerProofId) {
            throw new common_1.BadRequestException('Student has not created AnswerProof yet');
        }
        try {
            const teacher = await this.prisma.user.findUnique({
                where: { id: teacherId },
                select: { encryptedMnemonic: true, publicKey: true },
            });
            if (!teacher || !teacher.encryptedMnemonic) {
                throw new common_1.BadRequestException('Teacher wallet not configured');
            }
            const teacherComputer = computer_manager_1.computerManager.getComputer(teacher.encryptedMnemonic);
            const prizeAmount = attempt.quiz.prizePerWinner != null
                ? attempt.quiz.prizePerWinner
                : attempt.quiz.prizePool;
            const winnerCount = attempt.quiz.winnerCount ?? 1;
            console.log(`💰 Creating Prize Payment: ${prizeAmount.toString()} sats (${winnerCount} winner(s) sharing pool)`);
            const PaymentHelper = (await import('@bizz/contracts/deploy/Payment.deploy.js')).PaymentHelper;
            const paymentHelper = new PaymentHelper(teacherComputer, process.env.PAYMENT_MODULE_ID);
            const { tx: prizeTx, effect: prizeEffect } = await paymentHelper.createPayment({
                recipient: attempt.student.publicKey,
                amount: prizeAmount,
                purpose: 'Prize Payment',
                reference: attempt.contractId,
            });
            await teacherComputer.broadcast(prizeTx);
            await new Promise(resolve => setTimeout(resolve, 200));
            const prizePayment = prizeEffect.res;
            await this.mineBlocks(teacherComputer, 1);
            console.log(`✅ Prize Payment created: ${prizePayment._id}`);
            console.log(`✅ Amount: ${prizeAmount.toString()} sats`);
            await this.prisma.quizAttempt.update({
                where: { id: attemptId },
                data: {
                    prizePaymentId: prizePayment._id,
                    prizePaymentRev: prizePayment._rev,
                    prizeAmount,
                },
            });
            return {
                message: 'Prize Payment created successfully',
                prizePaymentId: prizePayment._id,
                amount: Number(prizeAmount),
                winnerCount,
            };
        }
        catch (error) {
            console.error('Error creating Prize Payment:', error);
            throw new common_1.BadRequestException(`Failed to create Prize Payment: ${error.message}`);
        }
    }
    async createSwapTransaction(teacherId, attemptId) {
        const attempt = await this.prisma.quizAttempt.findUnique({
            where: { id: attemptId },
            include: {
                quiz: {
                    select: {
                        teacherId: true,
                    },
                },
            },
        });
        if (!attempt)
            throw new common_1.NotFoundException('Quiz attempt not found');
        if (attempt.quiz.teacherId !== teacherId)
            throw new common_1.ForbiddenException('Not your quiz');
        if (!attempt.answerProofId) {
            throw new common_1.BadRequestException('AnswerProof not created yet');
        }
        if (!attempt.prizePaymentId) {
            throw new common_1.BadRequestException('Prize Payment not created yet');
        }
        try {
            const teacher = await this.prisma.user.findUnique({
                where: { id: teacherId },
                select: { encryptedMnemonic: true },
            });
            if (!teacher || !teacher.encryptedMnemonic) {
                throw new common_1.BadRequestException('Teacher wallet not configured');
            }
            const teacherComputer = computer_manager_1.computerManager.getComputer(teacher.encryptedMnemonic);
            console.log('📝 Creating SWAP transaction...');
            const PrizeSwapHelper = (await import('@bizz/contracts/deploy/PrizeSwap.deploy.js')).PrizeSwapHelper;
            const swapHelper = new PrizeSwapHelper(teacherComputer, process.env.PRIZE_SWAP_MODULE_ID);
            const [prizePaymentRev] = await teacherComputer.query({ ids: [attempt.prizePaymentId] });
            const prizePayment = await teacherComputer.sync(prizePaymentRev);
            const [answerProofRev] = await teacherComputer.query({ ids: [attempt.answerProofId] });
            const answerProof = await teacherComputer.sync(answerProofRev);
            const [attemptRev] = await teacherComputer.query({ ids: [attempt.contractId] });
            const syncedAttempt = await teacherComputer.sync(attemptRev);
            const { tx: swapTx } = await swapHelper.createPrizeSwapTx(prizePayment, answerProof, syncedAttempt, SIGHASH_SINGLE | SIGHASH_ANYONECANPAY);
            const partialTxHex = swapTx.toHex();
            console.log('✅ Partial SWAP transaction created');
            await this.prisma.quizAttempt.update({
                where: { id: attemptId },
                data: {
                    swapTxHex: partialTxHex,
                },
            });
            return {
                message: 'Partial SWAP transaction created',
                partialTxHex,
            };
        }
        catch (error) {
            console.error('Error creating SWAP transaction:', error);
            throw new common_1.BadRequestException(`Failed to create SWAP transaction: ${error.message}`);
        }
    }
    async executeSwap(studentId, attemptId) {
        const attempt = await this.prisma.quizAttempt.findUnique({
            where: { id: attemptId },
            include: {
                student: {
                    select: {
                        id: true,
                        encryptedMnemonic: true,
                        publicKey: true,
                    },
                },
                quiz: {
                    select: {
                        prizePool: true,
                        prizePerWinner: true,
                    },
                },
            },
        });
        if (!attempt)
            throw new common_1.NotFoundException('Quiz attempt not found');
        if (attempt.userId !== studentId)
            throw new common_1.ForbiddenException('Not your attempt');
        if (!attempt.swapTxHex) {
            throw new common_1.BadRequestException('SWAP transaction not created by teacher yet');
        }
        try {
            const studentComputer = computer_manager_1.computerManager.getComputer(attempt.student.encryptedMnemonic);
            console.log('🔐 Student completing SWAP...');
            const swapTx = lib_1.Transaction.fromHex(attempt.swapTxHex);
            await studentComputer.fund(swapTx);
            await studentComputer.sign(swapTx);
            await studentComputer.broadcast(swapTx);
            await new Promise(resolve => setTimeout(resolve, 200));
            await this.mineBlocks(studentComputer, 1);
            console.log('✅ SWAP executed successfully!');
            const [latestPrizeRev] = await studentComputer.query({ ids: [attempt.prizePaymentId] });
            const prizePayment = await studentComputer.sync(latestPrizeRev);
            const [latestAttemptRev] = await studentComputer.query({ ids: [attempt.contractId] });
            const finalAttempt = await studentComputer.sync(latestAttemptRev);
            console.log(`✅ Prize Payment now owned by: Student`);
            console.log(`✅ Attempt status: ${finalAttempt.status}`);
            console.log('💰 Claiming prize payment to release sats...');
            const PaymentHelper = (await import('@bizz/contracts/deploy/Payment.deploy.js')).PaymentHelper;
            const paymentHelper = new PaymentHelper(studentComputer, process.env.PAYMENT_MODULE_ID);
            const { tx: claimTx } = await paymentHelper.claimPayment(prizePayment);
            await studentComputer.broadcast(claimTx);
            await new Promise(resolve => setTimeout(resolve, 200));
            await this.mineBlocks(studentComputer, 1);
            const [claimedPrizeRev] = await studentComputer.query({ ids: [attempt.prizePaymentId] });
            const claimedPrize = await studentComputer.sync(claimedPrizeRev);
            console.log(`✅ Prize claimed! Payment status: ${claimedPrize.status}`);
            console.log(`✅ Sats released to student wallet`);
            await this.prisma.quizAttempt.update({
                where: { id: attemptId },
                data: {
                    status: 'PRIZE_CLAIMED',
                    prizePaymentRev: claimedPrize._rev,
                    contractRev: finalAttempt._rev,
                },
            });
            const satsClaimed = attempt.prizeAmount != null
                ? Number(attempt.prizeAmount)
                : attempt.quiz.prizePerWinner != null
                    ? Number(attempt.quiz.prizePerWinner)
                    : Number(attempt.quiz.prizePool);
            return {
                message: 'SWAP executed and prize claimed successfully',
                prizePaymentId: attempt.prizePaymentId,
                status: 'prize_claimed',
                satsClaimed,
            };
        }
        catch (error) {
            console.error('Error executing SWAP:', error);
            throw new common_1.BadRequestException(`Failed to execute SWAP: ${error.message}`);
        }
    }
    async claimPrize(studentId, attemptId) {
        const attempt = await this.prisma.quizAttempt.findUnique({
            where: { id: attemptId },
            include: {
                student: {
                    select: {
                        id: true,
                        encryptedMnemonic: true,
                    },
                },
                quiz: {
                    select: {
                        prizePool: true,
                    },
                },
            },
        });
        if (!attempt)
            throw new common_1.NotFoundException('Quiz attempt not found');
        if (attempt.userId !== studentId)
            throw new common_1.ForbiddenException('Not your attempt');
        if (attempt.status !== 'PRIZE_CLAIMED') {
            throw new common_1.BadRequestException(`Attempt is ${attempt.status}, must be PRIZE_CLAIMED to claim prize`);
        }
        if (!attempt.prizePaymentId) {
            throw new common_1.BadRequestException('No prize payment found');
        }
        try {
            const studentComputer = computer_manager_1.computerManager.getComputer(attempt.student.encryptedMnemonic);
            console.log('💰 Claiming prize payment...');
            const PaymentHelper = (await import('@bizz/contracts/deploy/Payment.deploy.js')).PaymentHelper;
            const paymentHelper = new PaymentHelper(studentComputer, process.env.PAYMENT_MODULE_ID);
            const [prizePaymentRev] = await studentComputer.query({ ids: [attempt.prizePaymentId] });
            const prizePayment = await studentComputer.sync(prizePaymentRev);
            const { tx: claimTx } = await paymentHelper.claimPayment(prizePayment);
            await studentComputer.broadcast(claimTx);
            await new Promise(resolve => setTimeout(resolve, 200));
            await this.mineBlocks(studentComputer, 1);
            const [claimedPrizeRev] = await studentComputer.query({ ids: [attempt.prizePaymentId] });
            const claimedPrize = await studentComputer.sync(claimedPrizeRev);
            console.log(`✅ Prize claimed! Payment status: ${claimedPrize.status}`);
            console.log(`✅ Released ${attempt.quiz.prizePool - claimedPrize._satoshis} sats to wallet`);
            return {
                message: 'Prize claimed successfully',
                prizePaymentId: attempt.prizePaymentId,
                status: claimedPrize.status,
            };
        }
        catch (error) {
            console.error('Error claiming prize:', error);
            throw new common_1.BadRequestException(`Failed to claim prize: ${error.message}`);
        }
    }
};
exports.PrizeService = PrizeService;
exports.PrizeService = PrizeService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], PrizeService);
//# sourceMappingURL=prize.service.js.map