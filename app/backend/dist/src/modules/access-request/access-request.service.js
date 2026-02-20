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
exports.AccessRequestService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const lib_1 = require("@bitcoin-computer/lib");
const computer_manager_1 = require("../../common/computer-manager");
const QuizAccess_deploy_js_1 = require("@bizz/contracts/deploy/QuizAccess.deploy.js");
const Payment_deploy_js_1 = require("@bizz/contracts/deploy/Payment.deploy.js");
const { SIGHASH_SINGLE, SIGHASH_ANYONECANPAY } = lib_1.Transaction;
const mockedRev = `mock-${'0'.repeat(64)}:0`;
class PaymentMock {
    _id;
    _rev;
    _root;
    _satoshis;
    _owners;
    recipient;
    amount;
    purpose;
    reference;
    constructor(satoshis, recipient, purpose, reference) {
        this._id = mockedRev;
        this._rev = mockedRev;
        this._root = mockedRev;
        this._satoshis = satoshis;
        this._owners = recipient ? [recipient] : [];
        this.recipient = recipient || '';
        this.amount = satoshis;
        this.purpose = purpose || 'Entry Fee';
        this.reference = reference || '';
    }
    transfer(to) {
        this._owners = [to];
    }
}
let AccessRequestService = class AccessRequestService {
    prisma;
    quizAccessModuleId;
    paymentModuleId;
    constructor() {
        this.prisma = new client_1.PrismaClient();
        this.quizAccessModuleId = process.env.QUIZ_ACCESS_MODULE_ID;
        this.paymentModuleId = process.env.PAYMENT_MODULE_ID;
        if (!this.quizAccessModuleId) {
            console.warn('⚠️ QUIZ_ACCESS_MODULE_ID not set in .env');
        }
        if (!this.paymentModuleId) {
            console.warn('⚠️ PAYMENT_MODULE_ID not set in .env');
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
    async requestAccess(studentId, createDto) {
        const student = await this.prisma.user.findUnique({
            where: { id: studentId },
            select: { id: true, publicKey: true, encryptedMnemonic: true },
        });
        if (!student || !student.publicKey) {
            throw new common_1.BadRequestException('Student wallet not configured');
        }
        const quiz = await this.prisma.quiz.findUnique({
            where: { id: createDto.quizId },
            include: {
                teacher: {
                    select: { id: true, publicKey: true },
                },
            },
        });
        if (!quiz)
            throw new common_1.NotFoundException('Quiz not found');
        if (quiz.status !== 'ACTIVE')
            throw new common_1.BadRequestException('Quiz is not active');
        if (new Date() > quiz.deadline)
            throw new common_1.BadRequestException('Quiz deadline passed');
        const existing = await this.prisma.quizAccessRequest.findFirst({
            where: {
                quizId: createDto.quizId,
                studentId,
                status: { in: ['PENDING', 'APPROVED', 'PAID'] },
            },
        });
        if (existing) {
            throw new common_1.BadRequestException(`Already have ${existing.status} request`);
        }
        const request = await this.prisma.quizAccessRequest.create({
            data: {
                quizId: createDto.quizId,
                studentId,
                status: 'PENDING',
            },
            include: {
                quiz: {
                    select: {
                        id: true,
                        title: true,
                        symbol: true,
                        entryFee: true,
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
        return {
            success: true,
            request: {
                ...request,
                quiz: {
                    ...request.quiz,
                    entryFee: request.quiz.entryFee.toString(),
                },
            },
        };
    }
    async approveRequest(requestId, teacherId) {
        const request = await this.prisma.quizAccessRequest.findUnique({
            where: { id: requestId },
            include: {
                quiz: {
                    include: {
                        teacher: {
                            select: {
                                id: true,
                                publicKey: true,
                                encryptedMnemonic: true,
                            },
                        },
                    },
                },
                student: {
                    select: {
                        id: true,
                        publicKey: true,
                    },
                },
            },
        });
        if (!request)
            throw new common_1.NotFoundException('Request not found');
        if (request.quiz.teacherId !== teacherId)
            throw new common_1.ForbiddenException('Only quiz creator can approve');
        if (request.status !== 'PENDING')
            throw new common_1.BadRequestException(`Request is ${request.status}`);
        try {
            const teacherComputer = computer_manager_1.computerManager.getComputer(request.quiz.teacher.encryptedMnemonic);
            const quizContract = await teacherComputer.sync(request.quiz.contractRev);
            const accessHelper = new QuizAccess_deploy_js_1.QuizAccessHelper(teacherComputer, this.quizAccessModuleId);
            const quizId = request.quiz.contractId.includes(':') ? request.quiz.contractId.split(':')[0] : request.quiz.contractId;
            const teacherPubKey = request.quiz.teacher.publicKey || '';
            const paymentMock = new PaymentMock(BigInt(request.quiz.entryFee), teacherPubKey, 'Entry Fee', quizId);
            console.log('📝 Creating partial exec tx...');
            const { tx: partialExecTx } = await accessHelper.createQuizAccessTx(quizContract, paymentMock, SIGHASH_SINGLE | SIGHASH_ANYONECANPAY);
            const partialTxHex = partialExecTx.toHex ? partialExecTx.toHex() : partialExecTx.toString();
            const updatedRequest = await this.prisma.quizAccessRequest.update({
                where: { id: requestId },
                data: {
                    status: 'APPROVED',
                    approvedAt: new Date(),
                    approvedBy: teacherId,
                    partialExecTx: {
                        txHex: partialTxHex,
                        quizRev: quizContract._rev,
                    },
                },
                include: {
                    quiz: {
                        select: {
                            id: true,
                            title: true,
                            entryFee: true,
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
            console.log('✅ Request approved with partial tx');
            return {
                success: true,
                request: {
                    ...updatedRequest,
                    quiz: {
                        ...updatedRequest.quiz,
                        entryFee: updatedRequest.quiz.entryFee.toString(),
                    },
                },
                partialTxHex,
                partialTx: partialTxHex,
            };
        }
        catch (error) {
            console.error('Approval error:', error);
            throw new common_1.InternalServerErrorException(`Approval failed: ${error.message}`);
        }
    }
    async completePayment(requestId, studentId) {
        const request = await this.prisma.quizAccessRequest.findUnique({
            where: { id: requestId },
            include: {
                quiz: {
                    select: {
                        id: true,
                        contractId: true,
                        entryFee: true,
                        teacherId: true,
                    },
                },
                student: {
                    select: {
                        id: true,
                        publicKey: true,
                        encryptedMnemonic: true,
                    },
                },
            },
        });
        if (!request)
            throw new common_1.NotFoundException('Request not found');
        if (request.studentId !== studentId)
            throw new common_1.ForbiddenException('Not your request');
        if (request.status !== 'APPROVED')
            throw new common_1.BadRequestException(`Request is ${request.status}`);
        if (!request.partialExecTx)
            throw new common_1.BadRequestException('No partial tx found');
        try {
            const studentComputer = computer_manager_1.computerManager.getComputer(request.student.encryptedMnemonic);
            const teacher = await this.prisma.user.findUnique({
                where: { id: request.quiz.teacherId },
                select: { publicKey: true },
            });
            console.log('💰 Creating entry fee payment...');
            if (!teacher || !teacher.publicKey) {
                throw new common_1.BadRequestException("Teacher wallet not configured");
            }
            const paymentHelper = new Payment_deploy_js_1.PaymentHelper(studentComputer, this.paymentModuleId);
            const { tx: paymentTx, effect: paymentEffect } = await paymentHelper.createPayment({
                recipient: teacher.publicKey,
                amount: request.quiz.entryFee,
                purpose: 'Entry Fee',
                reference: request.quiz.contractId,
            });
            await studentComputer.broadcast(paymentTx);
            await new Promise(resolve => setTimeout(resolve, 200));
            await this.mineBlocks(studentComputer, 1);
            const entryPayment = paymentEffect.res;
            console.log(`✅ Payment created: ${entryPayment._id}`);
            console.log('🔗 Updating partial tx with real payment...');
            const txHex = typeof request.partialExecTx === 'string'
                ? request.partialExecTx
                : request.partialExecTx.txHex;
            const partialTx = lib_1.Transaction.fromHex(txHex);
            const [paymentTxId, paymentIndex] = entryPayment._rev.split(':');
            partialTx.updateInput(1, { txId: paymentTxId, index: parseInt(paymentIndex, 10) });
            partialTx.updateOutput(1, { scriptPubKey: studentComputer.toScriptPubKey() });
            await studentComputer.fund(partialTx);
            await studentComputer.sign(partialTx);
            await studentComputer.broadcast(partialTx);
            await new Promise(resolve => setTimeout(resolve, 200));
            await this.mineBlocks(studentComputer, 1);
            console.log('✅ Quiz token purchased!');
            const studentRevs = await studentComputer.query({ publicKey: request.student.publicKey });
            let studentQuizToken = null;
            for (const rev of studentRevs) {
                const obj = await studentComputer.sync(rev);
                if (obj && obj.amount === BigInt(1) && obj.symbol) {
                    studentQuizToken = obj;
                    break;
                }
            }
            if (!studentQuizToken) {
                const [firstRev] = studentRevs;
                studentQuizToken = await studentComputer.sync(firstRev);
            }
            console.log(`  🎟️  Quiz token found: ${studentQuizToken._id}, amount=${studentQuizToken.amount}, symbol=${studentQuizToken.symbol}`);
            await this.prisma.quizAccessRequest.update({
                where: { id: requestId },
                data: {
                    status: 'PAID',
                    paidAt: new Date(),
                    quizTokenId: studentQuizToken._id,
                    entryPaymentId: entryPayment._id,
                },
            });
            return {
                success: true,
                message: 'Payment complete, quiz token received',
                quizTokenId: studentQuizToken._id,
            };
        }
        catch (error) {
            console.error('Payment error:', error);
            throw new common_1.InternalServerErrorException(`Payment failed: ${error.message}`);
        }
    }
    async getStudentRequests(studentId) {
        const requests = await this.prisma.quizAccessRequest.findMany({
            where: { studentId },
            include: {
                quiz: {
                    select: {
                        id: true,
                        title: true,
                        symbol: true,
                        entryFee: true,
                        deadline: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        return {
            success: true,
            requests: requests.map(req => ({
                ...req,
                quiz: {
                    ...req.quiz,
                    entryFee: req.quiz.entryFee.toString(),
                },
            })),
        };
    }
    async getTeacherRequests(teacherId) {
        const requests = await this.prisma.quizAccessRequest.findMany({
            where: {
                quiz: { teacherId },
                status: { in: ['PENDING', 'APPROVED', 'PAID', 'FEE_CLAIMED', 'STARTED'] },
            },
            include: {
                quiz: {
                    select: {
                        id: true,
                        title: true,
                        symbol: true,
                        entryFee: true,
                    },
                },
                student: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                attempt: {
                    select: {
                        id: true,
                        status: true,
                        score: true,
                        passed: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        return {
            success: true,
            requests: requests.map(req => ({
                ...req,
                quiz: {
                    ...req.quiz,
                    entryFee: req.quiz.entryFee.toString(),
                },
            })),
        };
    }
    async onModuleDestroy() {
        await this.prisma.$disconnect();
    }
    async claimPayment(requestId, teacherId) {
        const request = await this.prisma.quizAccessRequest.findUnique({
            where: { id: requestId },
            include: {
                quiz: {
                    include: {
                        teacher: {
                            select: {
                                id: true,
                                encryptedMnemonic: true,
                                publicKey: true,
                            },
                        },
                    },
                },
            },
        });
        if (!request)
            throw new common_1.NotFoundException('Request not found');
        if (request.quiz.teacherId !== teacherId)
            throw new common_1.ForbiddenException('Not your request');
        if (request.status !== 'PAID' && request.status !== 'FEE_CLAIMED' && request.status !== 'STARTED') {
            throw new common_1.BadRequestException(`Request is ${request.status}, cannot claim entry fee`);
        }
        if (request.feeClaimedAt) {
            throw new common_1.BadRequestException('Entry fee already claimed for this request');
        }
        if (!request.entryPaymentId) {
            throw new common_1.BadRequestException('Entry payment ID not recorded for this request');
        }
        const teacherComputer = computer_manager_1.computerManager.getComputer(request.quiz.teacher.encryptedMnemonic);
        console.log(`🔍 Looking up entry fee payment: ${request.entryPaymentId}`);
        const [entryPaymentRev] = await teacherComputer.query({ ids: [request.entryPaymentId] });
        if (!entryPaymentRev) {
            throw new common_1.NotFoundException('Entry fee payment not found on chain');
        }
        const entryPayment = await teacherComputer.sync(entryPaymentRev);
        console.log(`✅ Found payment: ${entryPayment._id}, status: ${entryPayment.status}`);
        try {
            const paymentHelper = new Payment_deploy_js_1.PaymentHelper(teacherComputer, this.paymentModuleId);
            const { tx: claimTx } = await paymentHelper.claimPayment(entryPayment);
            await teacherComputer.broadcast(claimTx);
            await new Promise(resolve => setTimeout(resolve, 200));
            await this.mineBlocks(teacherComputer, 1);
            await this.prisma.quizAccessRequest.update({
                where: { id: requestId },
                data: {
                    feeClaimedAt: new Date(),
                    ...(request.status === 'PAID' && { status: client_1.QuizAccessStatus.FEE_CLAIMED }),
                },
            });
            console.log('✅ Entry fee payment claimed!');
            return {
                success: true,
                message: 'Entry fee claimed successfully',
                paymentId: entryPayment._id,
                amount: entryPayment.amount.toString(),
            };
        }
        catch (error) {
            console.error('Claim payment error:', error);
            throw new common_1.InternalServerErrorException(`Failed to claim payment: ${error.message}`);
        }
    }
    async startAttempt(requestId, studentId) {
        const request = await this.prisma.quizAccessRequest.findUnique({
            where: { id: requestId },
            include: {
                quiz: {
                    select: {
                        id: true,
                        contractId: true,
                        contractRev: true,
                        teacherId: true,
                        deadline: true,
                        entryFee: true,
                    },
                },
                student: {
                    select: {
                        id: true,
                        publicKey: true,
                        encryptedMnemonic: true,
                    },
                },
            },
        });
        if (!request)
            throw new common_1.NotFoundException('Request not found');
        if (request.studentId !== studentId)
            throw new common_1.ForbiddenException('Not your request');
        if (request.status !== 'PAID' && request.status !== 'FEE_CLAIMED') {
            throw new common_1.BadRequestException(`Request is ${request.status}, must be PAID or FEE_CLAIMED`);
        }
        if (!request.quizTokenId)
            throw new common_1.BadRequestException('No quiz token found');
        if (new Date() > request.quiz.deadline)
            throw new common_1.BadRequestException('Quiz deadline passed');
        try {
            const studentComputer = computer_manager_1.computerManager.getComputer(request.student.encryptedMnemonic);
            const teacher = await this.prisma.user.findUnique({
                where: { id: request.quiz.teacherId },
                select: { publicKey: true },
            });
            if (!teacher || !teacher.publicKey) {
                throw new common_1.BadRequestException('Teacher wallet not configured');
            }
            console.log('🔍 Syncing quiz token...');
            const quizTokenRevs = await studentComputer.query({ ids: [request.quizTokenId] });
            if (!quizTokenRevs || quizTokenRevs.length === 0) {
                throw new common_1.BadRequestException(`Quiz token not found on blockchain: ${request.quizTokenId}`);
            }
            const syncedQuizToken = await studentComputer.sync(quizTokenRevs[0]);
            console.log(`  🎟️  Quiz token synced: amount=${syncedQuizToken.amount}, symbol=${syncedQuizToken.symbol}`);
            if (syncedQuizToken.amount !== BigInt(1)) {
                throw new common_1.BadRequestException(`Invalid quiz token state: amount=${syncedQuizToken.amount} (expected 1). Token may have already been used.`);
            }
            const correctQuizId = syncedQuizToken.originalQuizId || syncedQuizToken._id;
            console.log(`  Original Quiz ID: ${correctQuizId}`);
            console.log('📝 Creating QuizAttempt...');
            const QuizAttemptHelper = (await import('@bizz/contracts/deploy/QuizAttempt.deploy.js')).QuizAttemptHelper;
            const attemptHelper = new QuizAttemptHelper(studentComputer, process.env.QUIZ_ATTEMPT_MODULE_ID);
            const { tx: attemptTx, effect: attemptEffect } = await attemptHelper.createQuizAttempt({
                studentPubKey: request.student.publicKey,
                quizId: correctQuizId,
                answerCommitment: "",
                entryFee: request.quiz.entryFee,
                teacher: teacher.publicKey,
            });
            await studentComputer.broadcast(attemptTx);
            await new Promise(resolve => setTimeout(resolve, 200));
            await this.mineBlocks(studentComputer, 1);
            const tempAttempt = attemptEffect.res;
            console.log(`✅ QuizAttempt created: ${tempAttempt._id}`);
            console.log('🔥 Redeeming quiz token (burning)...');
            const [latestAttemptRev] = await studentComputer.query({ ids: [tempAttempt._id] });
            const syncedAttempt = await studentComputer.sync(latestAttemptRev);
            const [latestQuizTokenRevForRedeem] = await studentComputer.query({ ids: [request.quizTokenId] });
            const syncedQuizTokenForRedeem = await studentComputer.sync(latestQuizTokenRevForRedeem);
            console.log(`  🎟️  Quiz token re-synced: amount=${syncedQuizTokenForRedeem.amount}, symbol=${syncedQuizTokenForRedeem.symbol}`);
            const QuizRedemptionHelper = (await import('@bizz/contracts/deploy/QuizRedemption.deploy.js')).QuizRedemptionHelper;
            const redemptionHelper = new QuizRedemptionHelper(studentComputer, process.env.QUIZ_REDEMPTION_MODULE_ID);
            const { tx: redeemTx, effect: redeemEffect } = await redemptionHelper.redeemQuizToken(syncedQuizTokenForRedeem, syncedAttempt);
            await studentComputer.broadcast(redeemTx);
            await new Promise(resolve => setTimeout(resolve, 200));
            await this.mineBlocks(studentComputer, 1);
            const [burnedToken, validatedAttempt] = redeemEffect.res;
            console.log(`✅ Quiz token burned! Amount: ${burnedToken.amount}`);
            console.log(`✅ QuizAttempt validated: ${validatedAttempt._id}`);
            const dbAttempt = await this.prisma.quizAttempt.create({
                data: {
                    contractId: validatedAttempt._id,
                    contractRev: validatedAttempt._rev,
                    quizId: request.quiz.id,
                    userId: request.studentId,
                    status: 'OWNED',
                    score: null,
                    passed: null,
                },
            });
            await this.prisma.quizAccessRequest.update({
                where: { id: requestId },
                data: {
                    status: 'STARTED',
                    startedAt: new Date(),
                    attemptId: dbAttempt.id,
                },
            });
            return {
                success: true,
                message: 'Quiz started successfully',
                attemptId: dbAttempt.id,
                contractId: validatedAttempt._id,
                tokenBurned: true,
            };
        }
        catch (error) {
            throw new common_1.InternalServerErrorException(`Failed to start attempt: ${error.message}`);
        }
    }
};
exports.AccessRequestService = AccessRequestService;
exports.AccessRequestService = AccessRequestService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], AccessRequestService);
//# sourceMappingURL=access-request.service.js.map