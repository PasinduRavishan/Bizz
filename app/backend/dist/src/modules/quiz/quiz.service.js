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
exports.QuizService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const client_1 = require("@prisma/client");
const computer_manager_1 = require("../../common/computer-manager");
const ipfs_service_1 = require("../../common/ipfs.service");
const Quiz_deploy_js_1 = require("@bizz/contracts/deploy/Quiz.deploy.js");
function computeScore(answerCommitment, revealedAnswers, questions) {
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
    return Math.round((correct / totalQuestions) * 100);
}
let QuizService = class QuizService {
    prisma;
    quizModuleId;
    revealFailures = new Map();
    MAX_REVEAL_FAILURES = 3;
    constructor() {
        this.prisma = new client_1.PrismaClient();
        this.quizModuleId = process.env.QUIZ_MODULE_ID;
        if (!this.quizModuleId) {
            console.warn('⚠️ QUIZ_MODULE_ID not set in .env');
        }
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
    async create(teacherId, createQuizDto) {
        const teacher = await this.prisma.user.findUnique({
            where: { id: teacherId },
            select: {
                id: true,
                encryptedMnemonic: true,
                publicKey: true,
                role: true,
            },
        });
        if (!teacher)
            throw new common_1.NotFoundException('Teacher not found');
        if (teacher.role !== 'TEACHER')
            throw new common_1.ForbiddenException('Only teachers can create quizzes');
        if (!teacher.encryptedMnemonic || !teacher.publicKey)
            throw new common_1.BadRequestException('Wallet not configured');
        try {
            const teacherComputer = computer_manager_1.computerManager.getComputer(teacher.encryptedMnemonic);
            const quizHelper = new Quiz_deploy_js_1.QuizHelper(teacherComputer, this.quizModuleId);
            const initialSupply = createQuizDto.initialSupply || 1000;
            const quizParams = {
                teacherPubKey: teacher.publicKey,
                initialSupply: BigInt(initialSupply),
                symbol: createQuizDto.symbol,
                questionHashIPFS: createQuizDto.questionHashIPFS,
                answerHashes: createQuizDto.answerHashes,
                prizePool: BigInt(createQuizDto.prizePool),
                entryFee: BigInt(createQuizDto.entryFee),
                passThreshold: createQuizDto.passThreshold,
                deadline: createQuizDto.deadline,
                teacherRevealDeadline: createQuizDto.teacherRevealDeadline || (createQuizDto.deadline + 48 * 3600 * 1000),
            };
            console.log('📝 Creating Quiz on blockchain...');
            const { tx, effect } = await quizHelper.createQuiz(quizParams);
            await teacherComputer.broadcast(tx);
            await new Promise(resolve => setTimeout(resolve, 200));
            await this.mineBlocks(teacherComputer, 1);
            const quizContract = effect.res;
            console.log(`✅ Quiz created: ${quizContract._id}`);
            const dbQuiz = await this.prisma.quiz.create({
                data: {
                    title: createQuizDto.title || createQuizDto.symbol,
                    description: createQuizDto.description,
                    symbol: createQuizDto.symbol,
                    teacherId: teacher.id,
                    questionHashIPFS: createQuizDto.questionHashIPFS,
                    answerHashes: createQuizDto.answerHashes,
                    correctAnswers: createQuizDto.answerHashes,
                    salt: 'pending',
                    questionCount: createQuizDto.answerHashes.length,
                    entryFee: BigInt(createQuizDto.entryFee),
                    prizePool: BigInt(createQuizDto.prizePool),
                    passThreshold: createQuizDto.passThreshold,
                    deadline: new Date(createQuizDto.deadline),
                    teacherRevealDeadline: new Date(quizParams.teacherRevealDeadline),
                    status: 'ACTIVE',
                    contractId: quizContract._id,
                    contractRev: quizContract._rev,
                },
                include: {
                    teacher: {
                        select: { id: true, name: true, email: true, address: true },
                    },
                },
            });
            return {
                success: true,
                quiz: {
                    ...dbQuiz,
                    entryFee: dbQuiz.entryFee.toString(),
                    prizePool: dbQuiz.prizePool.toString(),
                },
            };
        }
        catch (error) {
            console.error('Quiz creation error:', error);
            throw new common_1.InternalServerErrorException(`Failed to create quiz: ${error.message}`);
        }
    }
    async createFromUI(teacherId, createQuizUIDto) {
        console.log('📝 Creating quiz from UI data...');
        try {
            const symbol = createQuizUIDto.title
                ? createQuizUIDto.title.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 10)
                : 'QUIZ' + Date.now().toString().substring(0, 6);
            console.log(`  Symbol: ${symbol}`);
            const questionsForIPFS = createQuizUIDto.questions.map(q => ({
                question: q.question,
                options: q.options,
            }));
            console.log('  📤 Uploading questions to IPFS...');
            const questionHashIPFS = await (0, ipfs_service_1.uploadQuestionsToIPFS)(questionsForIPFS);
            console.log(`  ✅ IPFS Hash: ${questionHashIPFS}`);
            const salt = (0, ipfs_service_1.generateSalt)();
            console.log('  🔐 Hashing answers...');
            const answerHashes = (0, ipfs_service_1.hashAnswers)(createQuizUIDto.correctAnswers, salt);
            console.log(`  ✅ Generated ${answerHashes.length} answer hashes`);
            const blockchainDto = {
                title: createQuizUIDto.title,
                description: createQuizUIDto.description,
                symbol,
                questionHashIPFS,
                answerHashes,
                entryFee: createQuizUIDto.entryFee,
                prizePool: createQuizUIDto.prizePool,
                passThreshold: createQuizUIDto.passThreshold,
                deadline: new Date(createQuizUIDto.deadline).getTime(),
                initialSupply: createQuizUIDto.initialSupply || 1000,
            };
            const result = await this.create(teacherId, blockchainDto);
            await this.prisma.quiz.update({
                where: { id: result.quiz.id },
                data: {
                    salt,
                    correctAnswers: createQuizUIDto.correctAnswers,
                    questions: questionsForIPFS,
                },
            });
            console.log('✅ Quiz created from UI successfully!');
            return {
                success: true,
                quizId: result.quiz.contractId,
                quiz: result.quiz,
            };
        }
        catch (error) {
            console.error('❌ Quiz creation from UI error:', error);
            throw new common_1.InternalServerErrorException(`Failed to create quiz: ${error.message}`);
        }
    }
    async findAll(filters) {
        const quizzes = await this.prisma.quiz.findMany({
            where: {
                ...(filters?.status && { status: filters.status }),
                ...(filters?.teacherId && { teacherId: filters.teacherId }),
            },
            include: {
                teacher: {
                    select: { id: true, name: true, email: true, address: true },
                },
                _count: {
                    select: { attempts: true, accessRequests: true },
                },
                attempts: {
                    select: {
                        id: true,
                        status: true,
                        passed: true,
                        answerProofId: true,
                        prizePaymentId: true,
                        swapTxHex: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        return {
            success: true,
            quizzes: quizzes.map(quiz => ({
                ...quiz,
                entryFee: quiz.entryFee.toString(),
                prizePool: quiz.prizePool.toString(),
                prizePerWinner: quiz.prizePerWinner != null ? quiz.prizePerWinner.toString() : null,
            })),
        };
    }
    async findOne(id, userId) {
        const dbQuiz = await this.prisma.quiz.findUnique({
            where: { id },
            include: {
                teacher: {
                    select: { id: true, name: true, email: true, encryptedMnemonic: true },
                },
                attempts: {
                    select: {
                        id: true,
                        contractId: true,
                        status: true,
                        score: true,
                        passed: true,
                        createdAt: true,
                        answerProofId: true,
                        prizePaymentId: true,
                        swapTxHex: true,
                        student: {
                            select: { id: true, name: true, email: true },
                        },
                    },
                    orderBy: { createdAt: 'asc' },
                },
            },
        });
        if (!dbQuiz)
            throw new common_1.NotFoundException('Quiz not found');
        try {
            const computer = computer_manager_1.computerManager.getComputer(dbQuiz.teacher.encryptedMnemonic);
            const quizContract = await computer.sync(dbQuiz.contractRev);
            const { teacher: { encryptedMnemonic: _m, ...safeTeacher }, ...quizRest } = dbQuiz;
            return {
                success: true,
                quiz: {
                    ...quizRest,
                    teacher: safeTeacher,
                    entryFee: dbQuiz.entryFee.toString(),
                    prizePool: dbQuiz.prizePool.toString(),
                    prizePerWinner: dbQuiz.prizePerWinner != null ? dbQuiz.prizePerWinner.toString() : null,
                    blockchainStatus: quizContract.status,
                    answerHashes: quizContract.status === 'revealed' ? quizContract.answerHashes : undefined,
                    revealedAnswers: quizContract.status === 'revealed' ? quizContract.revealedAnswers : undefined,
                },
            };
        }
        catch (error) {
            console.warn('Blockchain sync failed, using cache:', error.message);
            const { teacher: { encryptedMnemonic: _m, ...safeTeacher }, ...quizRest } = dbQuiz;
            return {
                success: true,
                quiz: {
                    ...quizRest,
                    teacher: safeTeacher,
                    entryFee: dbQuiz.entryFee.toString(),
                    prizePool: dbQuiz.prizePool.toString(),
                    prizePerWinner: dbQuiz.prizePerWinner != null ? dbQuiz.prizePerWinner.toString() : null,
                    warning: 'Cached data',
                },
            };
        }
    }
    async revealAnswers(quizId, teacherId, revealDto) {
        const dbQuiz = await this.prisma.quiz.findUnique({
            where: { id: quizId },
            include: {
                teacher: {
                    select: { id: true, encryptedMnemonic: true },
                },
                attempts: {
                    where: { status: 'COMMITTED' },
                    select: {
                        id: true,
                        answerCommitment: true,
                    },
                },
            },
        });
        if (!dbQuiz)
            throw new common_1.NotFoundException('Quiz not found');
        if (dbQuiz.teacherId !== teacherId)
            throw new common_1.ForbiddenException('Only creator can reveal');
        const answers = (revealDto.answers && revealDto.answers.length > 0)
            ? revealDto.answers
            : dbQuiz.correctAnswers ?? [];
        const salt = (revealDto.salt && revealDto.salt.trim() !== '')
            ? revealDto.salt
            : (dbQuiz.salt ?? '');
        if (!answers || answers.length === 0) {
            throw new common_1.BadRequestException('No answers found. Please provide answers or recreate the quiz.');
        }
        if (!salt) {
            throw new common_1.BadRequestException('No salt found. Please provide salt or recreate the quiz.');
        }
        try {
            const computer = computer_manager_1.computerManager.getComputer(dbQuiz.teacher.encryptedMnemonic);
            console.log('🔓 Revealing answers...');
            console.log(`  Using ${answers.length} answers from ${revealDto.answers?.length ? 'request body' : 'database'}`);
            const [latestQuizRev] = await computer.query({ ids: [dbQuiz.contractId] });
            const syncedQuiz = await computer.sync(latestQuizRev);
            let contractRev = syncedQuiz._rev;
            if (syncedQuiz.status === 'revealed') {
                console.log('ℹ️  Quiz already revealed on blockchain — syncing DB and pre-grading...');
            }
            else if (syncedQuiz.status !== 'active') {
                throw new common_1.BadRequestException(`Status is ${syncedQuiz.status}`);
            }
            else {
                const { tx: revealTx } = await computer.encodeCall({
                    target: syncedQuiz,
                    property: 'revealAnswers',
                    args: [answers, salt],
                    mod: process.env.QUIZ_MODULE_ID
                });
                await computer.broadcast(revealTx);
                await new Promise(resolve => setTimeout(resolve, 200));
                await this.mineBlocks(computer, 1);
                const [updatedQuizRev] = await computer.query({ ids: [dbQuiz.contractId] });
                const updatedQuiz = await computer.sync(updatedQuizRev);
                contractRev = updatedQuiz._rev;
            }
            console.log('✅ Answers revealed on blockchain');
            await this.prisma.quiz.update({
                where: { id: quizId },
                data: {
                    status: 'REVEALED',
                    revealedAnswers: answers,
                    salt,
                    contractRev,
                },
            });
            const quizWithQuestions = await this.prisma.quiz.findUnique({
                where: { id: quizId },
                select: { questions: true, passThreshold: true, prizePool: true },
            });
            const questions = quizWithQuestions?.questions;
            const passThreshold = quizWithQuestions?.passThreshold ?? 70;
            let gradedCount = 0;
            let passedCount = 0;
            for (const attempt of dbQuiz.attempts) {
                try {
                    const score = computeScore(attempt.answerCommitment, answers, questions);
                    const passed = score >= passThreshold;
                    await this.prisma.quizAttempt.update({
                        where: { id: attempt.id },
                        data: { score, passed },
                    });
                    gradedCount++;
                    if (passed)
                        passedCount++;
                    console.log(`  📊 Pre-graded attempt ${attempt.id}: score=${score}%, passed=${passed}`);
                }
                catch (e) {
                    console.warn(`  ⚠️  Could not pre-grade attempt ${attempt.id}: ${e.message}`);
                }
            }
            if (passedCount > 0 && quizWithQuestions?.prizePool) {
                const prizePerWinner = quizWithQuestions.prizePool / BigInt(passedCount);
                await this.prisma.quiz.update({
                    where: { id: quizId },
                    data: { winnerCount: passedCount, prizePerWinner },
                });
                console.log(`💰 Multi-winner distribution: ${passedCount} winner(s) × ${prizePerWinner.toString()} sats each (pool: ${quizWithQuestions.prizePool.toString()} sats)`);
            }
            else {
                await this.prisma.quiz.update({
                    where: { id: quizId },
                    data: { winnerCount: 0 },
                });
                console.log('ℹ️  No passing students — prize pool not distributed');
            }
            console.log(`✅ Pre-graded ${gradedCount} attempt(s): ${passedCount} passed, ${gradedCount - passedCount} failed`);
            return {
                success: true,
                message: 'Answers revealed',
                gradedAttempts: gradedCount,
                passedAttempts: passedCount,
                winnerCount: passedCount,
                prizePerWinner: passedCount > 0 && quizWithQuestions?.prizePool
                    ? (quizWithQuestions.prizePool / BigInt(passedCount)).toString()
                    : null,
            };
        }
        catch (error) {
            console.error('Reveal error:', error);
            throw new common_1.InternalServerErrorException(`Reveal failed: ${error.message}`);
        }
    }
    async autoRevealExpiredQuizzes() {
        try {
            const expiredQuizzes = await this.prisma.quiz.findMany({
                where: {
                    status: 'ACTIVE',
                    deadline: { lt: new Date() },
                    teacher: {
                        encryptedMnemonic: { not: null },
                    },
                },
                include: {
                    teacher: {
                        select: { id: true, encryptedMnemonic: true, address: true },
                    },
                },
            });
            if (expiredQuizzes.length === 0)
                return;
            console.log(`⏰ Auto-reveal: found ${expiredQuizzes.length} eligible expired quiz(zes)`);
            for (const quiz of expiredQuizzes) {
                const failures = this.revealFailures.get(quiz.id) ?? 0;
                if (failures >= this.MAX_REVEAL_FAILURES) {
                    console.warn(`⚠️  Quiz ${quiz.id} ("${quiz.title}") failed auto-reveal ${failures} time(s) — ` +
                        `marking COMPLETED to stop retrying.`);
                    await this.prisma.quiz.update({ where: { id: quiz.id }, data: { status: 'COMPLETED' } });
                    this.revealFailures.delete(quiz.id);
                    continue;
                }
                try {
                    console.log(`🔓 Auto-revealing quiz: ${quiz.id} ("${quiz.title}") — attempt ${failures + 1}/${this.MAX_REVEAL_FAILURES}`);
                    await this.revealAnswers(quiz.id, quiz.teacher.id, { answers: [], salt: '' });
                    this.revealFailures.delete(quiz.id);
                    console.log(`✅ Auto-reveal complete for quiz: ${quiz.id}`);
                }
                catch (err) {
                    const newCount = failures + 1;
                    this.revealFailures.set(quiz.id, newCount);
                    console.error(`❌ Auto-reveal failed for quiz ${quiz.id} (${newCount}/${this.MAX_REVEAL_FAILURES}):`, err.message);
                }
            }
        }
        catch (err) {
            console.error('❌ Auto-reveal cron job error:', err.message);
        }
    }
    async remove(quizId, teacherId) {
        const quiz = await this.prisma.quiz.findUnique({
            where: { id: quizId },
            include: { _count: { select: { attempts: true } } },
        });
        if (!quiz)
            throw new common_1.NotFoundException('Quiz not found');
        if (quiz.teacherId !== teacherId)
            throw new common_1.ForbiddenException('Only creator can delete');
        if (quiz._count.attempts > 0)
            throw new common_1.BadRequestException('Cannot delete with attempts');
        await this.prisma.quiz.delete({ where: { id: quizId } });
        return { success: true, message: 'Deleted from cache' };
    }
    async onModuleDestroy() {
        await this.prisma.$disconnect();
    }
};
exports.QuizService = QuizService;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_MINUTE),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], QuizService.prototype, "autoRevealExpiredQuizzes", null);
exports.QuizService = QuizService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], QuizService);
//# sourceMappingURL=quiz.service.js.map