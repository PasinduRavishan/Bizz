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
exports.QuizAttemptService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const lib_1 = require("@bitcoin-computer/lib");
const computer_manager_1 = require("../../common/computer-manager");
const { SIGHASH_SINGLE, SIGHASH_ANYONECANPAY } = lib_1.Transaction;
let QuizAttemptService = class QuizAttemptService {
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
    computeScore(answerCommitment, revealedAnswers, questions) {
        if (!answerCommitment)
            throw new Error('No answer commitment found');
        if (!revealedAnswers || revealedAnswers.length === 0)
            throw new Error('No revealed answers found');
        if (!questions || questions.length === 0)
            throw new Error('No questions found for scoring');
        const match = answerCommitment.match(/commitment-(\[[\d,\s]+\])-/);
        if (!match)
            throw new Error(`Cannot parse commitment format: ${answerCommitment.substring(0, 50)}`);
        let studentIndices;
        try {
            studentIndices = JSON.parse(match[1]);
        }
        catch {
            throw new Error('Cannot parse answer indices from commitment');
        }
        if (studentIndices.length === 0)
            throw new Error('No answers found in commitment');
        const totalQuestions = Math.min(studentIndices.length, revealedAnswers.length, questions.length);
        let correct = 0;
        for (let i = 0; i < totalQuestions; i++) {
            const correctText = revealedAnswers[i];
            const correctIdx = questions[i].options.findIndex(opt => opt === correctText);
            if (correctIdx !== -1 && studentIndices[i] === correctIdx) {
                correct++;
            }
        }
        const score = Math.round((correct / totalQuestions) * 100);
        console.log(`  📊 Score computation: ${correct}/${totalQuestions} correct = ${score}%`);
        return score;
    }
    async submitCommitment(attemptId, studentId, dto) {
        const dbAttempt = await this.prisma.quizAttempt.findUnique({
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
                        contractId: true,
                        deadline: true,
                    },
                },
            },
        });
        if (!dbAttempt)
            throw new common_1.NotFoundException('Quiz attempt not found');
        if (dbAttempt.userId !== studentId)
            throw new common_1.ForbiddenException('Not your attempt');
        if (!dbAttempt.contractId)
            throw new common_1.BadRequestException('Attempt contract not created yet');
        if (dbAttempt.status !== 'OWNED') {
            throw new common_1.BadRequestException(`Attempt is ${dbAttempt.status}, must be OWNED to submit commitment`);
        }
        if (new Date() > dbAttempt.quiz.deadline) {
            throw new common_1.BadRequestException('Quiz deadline has passed');
        }
        try {
            const studentComputer = computer_manager_1.computerManager.getComputer(dbAttempt.student.encryptedMnemonic);
            console.log('📝 Submitting answer commitment...');
            const QuizAttemptHelper = (await import('@bizz/contracts/deploy/QuizAttempt.deploy.js')).QuizAttemptHelper;
            const attemptHelper = new QuizAttemptHelper(studentComputer, process.env.QUIZ_ATTEMPT_MODULE_ID);
            const [latestAttemptRev] = await studentComputer.query({ ids: [dbAttempt.contractId] });
            const syncedAttempt = await studentComputer.sync(latestAttemptRev);
            const { tx: commitTx } = await attemptHelper.submitCommitment(syncedAttempt, dto.answerCommitment);
            await studentComputer.broadcast(commitTx);
            await new Promise(resolve => setTimeout(resolve, 200));
            await this.mineBlocks(studentComputer, 1);
            const [updatedAttemptRev] = await studentComputer.query({ ids: [dbAttempt.contractId] });
            const updatedAttempt = await studentComputer.sync(updatedAttemptRev);
            console.log(`✅ Commitment submitted, status: ${updatedAttempt.status}`);
            await this.prisma.quizAttempt.update({
                where: { id: attemptId },
                data: {
                    status: 'COMMITTED',
                    answerCommitment: dto.answerCommitment,
                    contractRev: updatedAttempt._rev,
                },
            });
            return {
                message: 'Answer commitment submitted successfully',
                attemptId: dbAttempt.contractId,
                status: 'committed',
            };
        }
        catch (error) {
            console.error('Error submitting commitment:', error);
            throw new common_1.BadRequestException(`Failed to submit commitment: ${error.message}`);
        }
    }
    async verifyAttempt(attemptId, studentId, dto) {
        const dbAttempt = await this.prisma.quizAttempt.findUnique({
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
                        contractId: true,
                        contractRev: true,
                        status: true,
                        passThreshold: true,
                        revealedAnswers: true,
                        questions: true,
                    },
                },
            },
        });
        if (!dbAttempt)
            throw new common_1.NotFoundException('Quiz attempt not found');
        if (dbAttempt.userId !== studentId)
            throw new common_1.ForbiddenException('Not your attempt');
        if (!dbAttempt.contractId)
            throw new common_1.BadRequestException('Attempt contract not created yet');
        if (dbAttempt.status !== 'COMMITTED') {
            throw new common_1.BadRequestException(`Attempt is ${dbAttempt.status}, must be COMMITTED to verify`);
        }
        if (dbAttempt.quiz.status !== 'REVEALED') {
            throw new common_1.BadRequestException('Teacher has not revealed answers yet');
        }
        let computedScore;
        try {
            computedScore = this.computeScore(dbAttempt.answerCommitment, dbAttempt.quiz.revealedAnswers, dbAttempt.quiz.questions);
            console.log(`  📊 Server-computed score: ${computedScore}%`);
        }
        catch (e) {
            if (dto.score !== undefined && dto.score !== null) {
                console.warn(`  ⚠️  Score computation failed (${e.message}), using client score: ${dto.score}%`);
                computedScore = dto.score;
            }
            else {
                throw new common_1.BadRequestException(`Cannot compute score: ${e.message}`);
            }
        }
        try {
            const studentComputer = computer_manager_1.computerManager.getComputer(dbAttempt.student.encryptedMnemonic);
            console.log('✅ Verifying quiz attempt...');
            const passed = computedScore >= dbAttempt.quiz.passThreshold;
            console.log(`  Score: ${computedScore}%, Threshold: ${dbAttempt.quiz.passThreshold}%, Passed: ${passed}`);
            await this.mineBlocks(studentComputer, 1);
            console.log(`  Querying latest attempt state for ID: ${dbAttempt.contractId}`);
            const [latestAttemptRev] = await studentComputer.query({ ids: [dbAttempt.contractId] });
            console.log(`  Syncing attempt from rev: ${latestAttemptRev}`);
            const syncedAttempt = await studentComputer.sync(latestAttemptRev);
            console.log(`  ✅ Synced successfully`);
            console.log(`  Encoding verify call...`);
            const { tx: verifyTx } = await studentComputer.encodeCall({
                target: syncedAttempt,
                property: 'verify',
                args: [computedScore, passed],
                mod: process.env.QUIZ_ATTEMPT_MODULE_ID,
            });
            await studentComputer.broadcast(verifyTx);
            await new Promise(resolve => setTimeout(resolve, 200));
            await this.mineBlocks(studentComputer, 1);
            const [updatedAttemptRev] = await studentComputer.query({ ids: [dbAttempt.contractId] });
            const updatedAttempt = await studentComputer.sync(updatedAttemptRev);
            console.log(`✅ Attempt verified: score=${updatedAttempt.score}%, passed=${updatedAttempt.passed}, status=${updatedAttempt.status}`);
            await this.prisma.quizAttempt.update({
                where: { id: attemptId },
                data: {
                    status: 'VERIFIED',
                    score: computedScore,
                    passed,
                    contractRev: updatedAttempt._rev,
                },
            });
            if (passed) {
                console.log('🏆 Student passed! Auto-creating prize payment and swap tx...');
                try {
                    await this.autoCreatePrizePaymentAndSwap(attemptId, studentId);
                    console.log('✅ Prize payment and swap tx auto-created');
                }
                catch (prizeError) {
                    console.error('⚠️  Auto prize creation failed (non-fatal):', prizeError.message);
                }
            }
            return {
                message: 'Attempt verified successfully',
                attemptId: dbAttempt.contractId,
                score: computedScore,
                passed,
                status: 'verified',
            };
        }
        catch (error) {
            console.error('Error verifying attempt:', error);
            throw new common_1.BadRequestException(`Failed to verify attempt: ${error.message}`);
        }
    }
    async autoCreatePrizePaymentAndSwap(attemptId, studentId) {
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
                        id: true,
                        contractId: true,
                        teacherId: true,
                        prizePool: true,
                        prizePerWinner: true,
                        winnerCount: true,
                        questions: true,
                        passThreshold: true,
                    },
                },
            },
        });
        if (!attempt)
            throw new Error('Attempt not found');
        if (!attempt.passed)
            throw new Error('Attempt did not pass');
        const teacher = await this.prisma.user.findUnique({
            where: { id: attempt.quiz.teacherId },
            select: { encryptedMnemonic: true, publicKey: true },
        });
        if (!teacher || !teacher.encryptedMnemonic)
            throw new Error('Teacher wallet not configured');
        const studentComputer = computer_manager_1.computerManager.getComputer(attempt.student.encryptedMnemonic);
        const teacherComputer = computer_manager_1.computerManager.getComputer(teacher.encryptedMnemonic);
        console.log('  📜 Auto-creating AnswerProof...');
        let answers;
        const commitment = attempt.answerCommitment;
        if (!commitment)
            throw new Error('No answer commitment on attempt');
        const match = commitment.match(/commitment-(\[[\d,\s]+\])-/);
        if (!match)
            throw new Error(`Cannot parse commitment: ${commitment.substring(0, 60)}`);
        const studentIndices = JSON.parse(match[1]);
        const questions = attempt.quiz.questions;
        if (!questions || questions.length === 0) {
            answers = studentIndices.map(idx => String(idx));
        }
        else {
            answers = studentIndices.map((idx, i) => {
                const q = questions[i];
                return (q && q.options && q.options[idx] !== undefined) ? q.options[idx] : String(idx);
            });
        }
        const score = attempt.score ?? 0;
        const passed = attempt.passed ?? false;
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
        await this.mineBlocks(studentComputer, 1);
        const answerProof = proofEffect.res;
        console.log(`  ✅ AnswerProof created: ${answerProof._id}`);
        await this.prisma.quizAttempt.update({
            where: { id: attemptId },
            data: { answerProofId: answerProof._id },
        });
        const prizeAmount = attempt.quiz.prizePerWinner != null
            ? attempt.quiz.prizePerWinner
            : attempt.quiz.prizePool;
        const winnerCount = attempt.quiz.winnerCount ?? 1;
        console.log(`  💰 Auto-creating Prize Payment: ${prizeAmount.toString()} sats (${winnerCount} winner(s) sharing pool of ${attempt.quiz.prizePool.toString()} sats)`);
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
        await this.mineBlocks(teacherComputer, 1);
        const prizePayment = prizeEffect.res;
        console.log(`  ✅ Prize Payment created: ${prizePayment._id} (amount: ${prizeAmount.toString()} sats)`);
        await this.prisma.quizAttempt.update({
            where: { id: attemptId },
            data: {
                prizePaymentId: prizePayment._id,
                prizePaymentRev: prizePayment._rev,
                prizeAmount,
            },
        });
        console.log('  🔄 Auto-creating partial SWAP tx...');
        const PrizeSwapHelper = (await import('@bizz/contracts/deploy/PrizeSwap.deploy.js')).PrizeSwapHelper;
        const swapHelper = new PrizeSwapHelper(teacherComputer, process.env.PRIZE_SWAP_MODULE_ID);
        const [prizePaymentRev] = await teacherComputer.query({ ids: [prizePayment._id] });
        const syncedPrizePayment = await teacherComputer.sync(prizePaymentRev);
        const [answerProofRev] = await teacherComputer.query({ ids: [answerProof._id] });
        const syncedAnswerProof = await teacherComputer.sync(answerProofRev);
        const [attemptRev] = await teacherComputer.query({ ids: [attempt.contractId] });
        const syncedAttempt = await teacherComputer.sync(attemptRev);
        const { tx: swapTx } = await swapHelper.createPrizeSwapTx(syncedPrizePayment, syncedAnswerProof, syncedAttempt, SIGHASH_SINGLE | SIGHASH_ANYONECANPAY);
        const partialSwapTxHex = swapTx.toHex();
        console.log('  ✅ Partial SWAP tx created');
        await this.prisma.quizAttempt.update({
            where: { id: attemptId },
            data: { swapTxHex: partialSwapTxHex },
        });
        console.log('✅ All prize components auto-created — student can now claim prize!');
    }
    async getStudentAttempts(studentId) {
        const attempts = await this.prisma.quizAttempt.findMany({
            where: { userId: studentId },
            include: {
                quiz: {
                    select: {
                        id: true,
                        title: true,
                        symbol: true,
                        contractId: true,
                        status: true,
                        deadline: true,
                        passThreshold: true,
                        prizePool: true,
                        prizePerWinner: true,
                        winnerCount: true,
                        entryFee: true,
                        questionCount: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        return {
            attempts: attempts.map(a => ({
                ...a,
                prizeAmount: a.prizeAmount != null ? a.prizeAmount.toString() : null,
                quiz: {
                    ...a.quiz,
                    prizePool: a.quiz.prizePool.toString(),
                    prizePerWinner: a.quiz.prizePerWinner != null ? a.quiz.prizePerWinner.toString() : null,
                    entryFee: a.quiz.entryFee.toString(),
                },
            })),
        };
    }
    async getAttempt(attemptId, userId) {
        const attempt = await this.prisma.quizAttempt.findUnique({
            where: { id: attemptId },
            include: {
                quiz: {
                    select: {
                        id: true,
                        title: true,
                        symbol: true,
                        contractId: true,
                        status: true,
                        deadline: true,
                        passThreshold: true,
                        prizePool: true,
                        prizePerWinner: true,
                        winnerCount: true,
                        entryFee: true,
                        questionCount: true,
                        revealedAnswers: true,
                        teacherId: true,
                    },
                },
                student: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
        });
        if (!attempt)
            throw new common_1.NotFoundException('Attempt not found');
        if (attempt.userId !== userId && attempt.quiz.teacherId !== userId) {
            throw new common_1.ForbiddenException('Not authorized to view this attempt');
        }
        return {
            attempt: {
                ...attempt,
                prizeAmount: attempt.prizeAmount != null ? attempt.prizeAmount.toString() : null,
                quiz: {
                    ...attempt.quiz,
                    prizePool: attempt.quiz.prizePool.toString(),
                    prizePerWinner: attempt.quiz.prizePerWinner != null ? attempt.quiz.prizePerWinner.toString() : null,
                    entryFee: attempt.quiz.entryFee.toString(),
                },
            },
        };
    }
};
exports.QuizAttemptService = QuizAttemptService;
exports.QuizAttemptService = QuizAttemptService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], QuizAttemptService);
//# sourceMappingURL=quiz-attempt.service.js.map