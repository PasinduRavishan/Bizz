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
const computer_manager_1 = require("../../common/computer-manager");
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
                quiz: {
                    ...a.quiz,
                    prizePool: a.quiz.prizePool.toString(),
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
                quiz: {
                    ...attempt.quiz,
                    prizePool: attempt.quiz.prizePool.toString(),
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