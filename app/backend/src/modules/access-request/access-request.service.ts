import { Injectable, NotFoundException, BadRequestException, ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { PrismaClient, QuizAccessStatus } from "@prisma/client";
import { Computer, Transaction } from "@bitcoin-computer/lib";
import { CreateAccessRequestDto } from './dto';
import { computerManager } from '../../common/computer-manager';

// Import contract helpers
import { QuizAccess, QuizAccessHelper } from '@bizz/contracts/deploy/QuizAccess.deploy.js';
import { Payment, PaymentHelper } from '@bizz/contracts/deploy/Payment.deploy.js';
import { Quiz } from '@bizz/contracts/deploy/Quiz.deploy.js';

const { SIGHASH_SINGLE, SIGHASH_ANYONECANPAY } = Transaction;

// Mock payment class for partial tx (plain class matching tbc20.test.ts exactly)
const mockedRev = `mock-${'0'.repeat(64)}:0`;

class PaymentMock {
  _id: string;
  _rev: string;
  _root: string;
  _satoshis: bigint;
  _owners: string[];
  recipient: string;
  amount: bigint;
  purpose: string;
  reference: string;

  constructor(satoshis: bigint, recipient: string, purpose: string, reference: string) {
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

  transfer(to: string): void {
    this._owners = [to];
  }
}

/**
 * AccessRequestService - Handles quiz access request flow
 *
 * Flow (from tbc20.test.ts):
 * 1. Student requests access → Teacher creates partial exec tx
 * 2. Teacher approves → Returns partial tx to student
 * 3. Student pays → Creates Payment, updates tx, broadcasts
 * 4. Student gets quiz token → Can start attempt
 *
 * Architecture:
 * - Blockchain = Source of truth (Payment + QuizAccess.exec)
 * - Database = Track request state (PENDING → APPROVED → PAID → STARTED)
 */
@Injectable()
export class AccessRequestService {
  private prisma: PrismaClient;
  private quizAccessModuleId: string | undefined;
  private paymentModuleId: string | undefined;
  private quizModuleId: string | undefined;

  constructor() {
    this.prisma = new PrismaClient();
    this.quizAccessModuleId = process.env.QUIZ_ACCESS_MODULE_ID;
    this.paymentModuleId = process.env.PAYMENT_MODULE_ID;
    this.quizModuleId = process.env.QUIZ_MODULE_ID;

    if (!this.quizAccessModuleId) {
      console.warn('⚠️ QUIZ_ACCESS_MODULE_ID not set in .env');
    }
    if (!this.paymentModuleId) {
      console.warn('⚠️ PAYMENT_MODULE_ID not set in .env');
    }
    if (!this.quizModuleId) {
      console.warn('⚠️ QUIZ_MODULE_ID not set in .env');
    }
  }

  /**
   * Mine blocks after broadcast (same as TestHelper.mineBlocks in tbc20.test.ts)
   */
  private async mineBlocks(computer: Computer, count: number = 1): Promise<void> {
    try {
      const newAddress = await computer.rpcCall('getnewaddress', 'mywallet legacy')
      console.log(`  ⛏️  Mining ${count} block(s)...`)
      await computer.rpcCall('generatetoaddress', `${count} ${newAddress.result}`)
      await new Promise(resolve => setTimeout(resolve, 500)) // Wait for block propagation (SAME as TestHelper)
    } catch (error) {
      console.error('  ❌ Error mining blocks:', (error as Error).message)
    }
  }

  /**
   * Student requests quiz access — AUTO-APPROVES immediately.
   *
   * On-demand minting flow:
   * 1. Teacher mints a fresh quiz token (quiz.mint(teacherPubKey, 1n)) — token owned by teacher
   * 2. Update quiz.contractRev in DB (quiz UTXO changes after mint)
   * 3. Create partial tx using the MINTED TOKEN (not the quiz template)
   *    — teacher signs input[0] (mintedToken) with SIGHASH_SINGLE|SIGHASH_ANYONECANPAY
   * 4. Store partial tx + mintedToken info — student fills in payment later
   *
   * This ensures the quiz template UTXO is never touched during student payments,
   * allowing multiple students to pay concurrently without UTXO contention.
   */
  async requestAccess(studentId: string, createDto: CreateAccessRequestDto) {
    const student = await this.prisma.user.findUnique({
      where: { id: studentId },
      select: { id: true, publicKey: true, encryptedMnemonic: true },
    });

    if (!student || !student.publicKey) {
      throw new BadRequestException('Student wallet not configured');
    }

    const quiz = await this.prisma.quiz.findUnique({
      where: { id: createDto.quizId },
      include: {
        teacher: {
          select: { id: true, publicKey: true, encryptedMnemonic: true },
        },
      },
    });

    if (!quiz) throw new NotFoundException('Quiz not found');
    if (quiz.status !== 'ACTIVE') throw new BadRequestException('Quiz is not active');
    if (new Date() > quiz.deadline) throw new BadRequestException('Quiz deadline passed');

    if (!quiz.teacher.encryptedMnemonic || !quiz.teacher.publicKey) {
      throw new BadRequestException('Teacher wallet not configured');
    }

    // Check if already requested
    const existing = await this.prisma.quizAccessRequest.findFirst({
      where: {
        quizId: createDto.quizId,
        studentId,
        status: { in: ['PENDING', 'APPROVED', 'PAID', 'FEE_CLAIMED', 'STARTED'] },
      },
    });

    if (existing) {
      throw new BadRequestException(`Already have ${existing.status} request`);
    }

    // Create request with PENDING status first
    const request = await this.prisma.quizAccessRequest.create({
      data: {
        quizId: createDto.quizId,
        studentId,
        status: 'PENDING',
      },
    });

    try {
      console.log(`🤖 Auto-approving request ${request.id} for student ${studentId}...`);

      const teacherComputer = computerManager.getComputer(quiz.teacher.encryptedMnemonic);
      const teacherPubKey = quiz.teacher.publicKey;

      // STEP 1: Sync quiz template from blockchain (always use current state)
      console.log('🔍 Syncing quiz template...');
      const [currentQuizRev] = await teacherComputer.query({ ids: [quiz.contractId] });
      if (!currentQuizRev) throw new Error('Quiz contract not found on blockchain');
      const quizContract = await teacherComputer.sync(currentQuizRev);

      // STEP 2: Mint a fresh quiz token for this student request (owned by teacher)
      console.log('🪙 Minting quiz token on-demand...');
      const { tx: mintTx, effect: mintEffect } = await teacherComputer.encodeCall({
        target: quizContract,
        property: 'mint',
        args: [teacherPubKey, 1n],
        mod: this.quizModuleId,
      });

      await teacherComputer.broadcast(mintTx);
      await new Promise(resolve => setTimeout(resolve, 200));
      await this.mineBlocks(teacherComputer, 1);

      const mintedToken = mintEffect.res;
      console.log(`✅ Quiz token minted: ${mintedToken._id}`);

      // STEP 3: Update quiz.contractRev in DB — quiz UTXO changed after mint
      const [newQuizRev] = await teacherComputer.query({ ids: [quiz.contractId] });
      if (newQuizRev) {
        await this.prisma.quiz.update({
          where: { id: quiz.id },
          data: { contractRev: newQuizRev },
        });
        console.log(`📝 Updated quiz contractRev after mint`);
      }

      // STEP 4: Create partial tx using the MINTED TOKEN (not the quiz template)
      const accessHelper = new QuizAccessHelper(teacherComputer, this.quizAccessModuleId);
      const paymentMock = new PaymentMock(
        BigInt(quiz.entryFee),
        teacherPubKey,
        'Entry Fee',
        quiz.contractId,
      );

      console.log('📝 Creating partial exec tx with minted token...');
      const { tx: partialExecTx } = await accessHelper.createQuizAccessTx(
        mintedToken,
        paymentMock,
        SIGHASH_SINGLE | SIGHASH_ANYONECANPAY
      );

      const partialTxHex = partialExecTx.toHex ? partialExecTx.toHex() : partialExecTx.toString();

      // Update request to APPROVED — store partial tx + minted token reference
      const approvedRequest = await this.prisma.quizAccessRequest.update({
        where: { id: request.id },
        data: {
          status: 'APPROVED',
          approvedAt: new Date(),
          approvedBy: quiz.teacherId,
          partialExecTx: {
            txHex: partialTxHex,
            mintedTokenId: mintedToken._id,
            mintedTokenRev: mintedToken._rev,
          },
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

      console.log(`✅ Request auto-approved with on-demand minted token: ${request.id}`);

      return {
        success: true,
        request: {
          ...approvedRequest,
          quiz: {
            ...approvedRequest.quiz,
            entryFee: approvedRequest.quiz.entryFee.toString(),
          },
        },
      };
    } catch (error) {
      console.error('❌ Auto-approval failed, removing pending request:', error);
      await this.prisma.quizAccessRequest.delete({ where: { id: request.id } }).catch(() => {});
      throw new InternalServerErrorException(`Failed to process access request: ${error.message}`);
    }
  }

  /**
   * Teacher manually approves a PENDING request — on-demand minting flow.
   *
   * Same logic as requestAccess() auto-approval:
   * 1. Mint a fresh quiz token (owned by teacher)
   * 2. Update quiz.contractRev in DB after mint
   * 3. Create partial tx using the MINTED TOKEN as input[0]
   * 4. Store { txHex, mintedTokenId, mintedTokenRev } — student fills payment later
   */
  async approveRequest(requestId: string, teacherId: string) {
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

    if (!request) throw new NotFoundException('Request not found');
    if (request.quiz.teacherId !== teacherId) throw new ForbiddenException('Only quiz creator can approve');
    if (request.status !== 'PENDING') throw new BadRequestException(`Request is ${request.status}`);

    if (!request.quiz.teacher.encryptedMnemonic || !request.quiz.teacher.publicKey) {
      throw new BadRequestException('Teacher wallet not configured');
    }

    try {
      const teacherComputer = computerManager.getComputer(request.quiz.teacher.encryptedMnemonic);
      const teacherPubKey = request.quiz.teacher.publicKey;

      // STEP 1: Sync quiz template from blockchain (always use current state)
      console.log('🔍 Syncing quiz template...');
      const [currentQuizRev] = await teacherComputer.query({ ids: [request.quiz.contractId] });
      if (!currentQuizRev) throw new Error('Quiz contract not found on blockchain');
      const quizContract = await teacherComputer.sync(currentQuizRev);

      // STEP 2: Mint a fresh quiz token for this student (owned by teacher)
      console.log('🪙 Minting quiz token on-demand...');
      const { tx: mintTx, effect: mintEffect } = await teacherComputer.encodeCall({
        target: quizContract,
        property: 'mint',
        args: [teacherPubKey, 1n],
        mod: this.quizModuleId,
      });

      await teacherComputer.broadcast(mintTx);
      await new Promise(resolve => setTimeout(resolve, 200));
      await this.mineBlocks(teacherComputer, 1);

      const mintedToken = mintEffect.res;
      console.log(`✅ Quiz token minted: ${mintedToken._id}`);

      // STEP 3: Update quiz.contractRev in DB — quiz UTXO changed after mint
      const [newQuizRev] = await teacherComputer.query({ ids: [request.quiz.contractId] });
      if (newQuizRev) {
        await this.prisma.quiz.update({
          where: { id: request.quiz.id },
          data: { contractRev: newQuizRev },
        });
        console.log(`📝 Updated quiz contractRev after mint`);
      }

      // STEP 4: Create partial tx using the MINTED TOKEN (not the quiz template)
      const accessHelper = new QuizAccessHelper(teacherComputer, this.quizAccessModuleId);
      const paymentMock = new PaymentMock(
        BigInt(request.quiz.entryFee),
        teacherPubKey,
        'Entry Fee',
        request.quiz.contractId,
      );

      console.log('📝 Creating partial exec tx with minted token...');
      const { tx: partialExecTx } = await accessHelper.createQuizAccessTx(
        mintedToken,
        paymentMock,
        SIGHASH_SINGLE | SIGHASH_ANYONECANPAY
      );

      const partialTxHex = partialExecTx.toHex ? partialExecTx.toHex() : partialExecTx.toString();

      // Update request to APPROVED — store partial tx + minted token reference
      const updatedRequest = await this.prisma.quizAccessRequest.update({
        where: { id: requestId },
        data: {
          status: 'APPROVED',
          approvedAt: new Date(),
          approvedBy: teacherId,
          partialExecTx: {
            txHex: partialTxHex,
            mintedTokenId: mintedToken._id,
            mintedTokenRev: mintedToken._rev,
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

      console.log(`✅ Request approved with on-demand minted token: ${mintedToken._id}`);

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
    } catch (error) {
      console.error('Approval error:', error);
      throw new InternalServerErrorException(`Approval failed: ${error.message}`);
    }
  }

  /**
   * Student completes payment — on-demand minting flow.
   *
   * The partial tx stored at approval already contains the pre-minted token
   * (owned by teacher) as input[0]. Student just needs to:
   * 1. Create real Payment contract
   * 2. Fill input[1] + output[1] in the stored partial tx
   * 3. Fund, sign, broadcast → teacher's minted token transfers to student
   *
   * No quiz template UTXO is involved here — zero UTXO contention between students.
   */
  async completePayment(requestId: string, studentId: string) {
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
            encryptedMnemonic: true,
          },
        },
      },
    });

    if (!request) throw new NotFoundException('Request not found');
    if (request.studentId !== studentId) throw new ForbiddenException('Not your request');
    if (request.status !== 'APPROVED') throw new BadRequestException(`Request is ${request.status}`);
    if (!request.partialExecTx) throw new BadRequestException('No partial tx found — request may need re-approval');

    if (!request.quiz.teacher?.publicKey) {
      throw new BadRequestException('Teacher wallet not configured');
    }

    try {
      const studentComputer = computerManager.getComputer(request.student.encryptedMnemonic);

      // STEP 1: Create real Payment contract (student pays entry fee)
      console.log('💰 Creating entry fee payment...');
      const paymentHelper = new PaymentHelper(studentComputer, this.paymentModuleId);
      const { tx: paymentTx, effect: paymentEffect } = await paymentHelper.createPayment({
        recipient: request.quiz.teacher.publicKey,
        amount: request.quiz.entryFee,
        purpose: 'Entry Fee',
        reference: request.quiz.contractId,
      });

      await studentComputer.broadcast(paymentTx);
      await new Promise(resolve => setTimeout(resolve, 200));
      await this.mineBlocks(studentComputer, 1);

      const entryPayment = paymentEffect.res;
      console.log(`✅ Payment created: ${entryPayment._id}`);

      // STEP 2: Load stored partial tx (has pre-minted token as input[0], mock as input[1])
      console.log('🔗 Completing partial tx with real payment...');
      const txHex = typeof request.partialExecTx === 'string'
        ? request.partialExecTx
        : (request.partialExecTx as any).txHex;
      const partialTx = Transaction.fromHex(txHex);

      // Replace mock payment (input[1]) with real payment UTXO
      const [paymentTxId, paymentIndex] = entryPayment._rev.split(':');
      partialTx.updateInput(1, { txId: paymentTxId, index: parseInt(paymentIndex, 10) });
      // Set output[1] to student's address (receives the minted quiz token)
      partialTx.updateOutput(1, { scriptPubKey: studentComputer.toScriptPubKey() });

      await studentComputer.fund(partialTx);
      await studentComputer.sign(partialTx);
      await studentComputer.broadcast(partialTx);
      await new Promise(resolve => setTimeout(resolve, 200));
      await this.mineBlocks(studentComputer, 1);

      console.log('✅ Quiz token transferred to student!');

      // STEP 3: Find the minted token now owned by student
      // Use stored mintedTokenId for a direct lookup (faster than scanning all UTXOs)
      const storedTx = request.partialExecTx as any;
      const mintedTokenId = storedTx?.mintedTokenId;

      let studentQuizToken: any = null;

      if (mintedTokenId) {
        const [mintedTokenRev] = await studentComputer.query({ ids: [mintedTokenId] });
        if (mintedTokenRev) {
          studentQuizToken = await studentComputer.sync(mintedTokenRev);
        }
      }

      // Fallback: scan student's UTXOs for a quiz token (amount=1, has symbol)
      if (!studentQuizToken) {
        const studentRevs = await studentComputer.query({ publicKey: request.student.publicKey });
        for (const rev of studentRevs) {
          const obj = await studentComputer.sync(rev);
          if (obj && obj.amount === BigInt(1) && obj.symbol) {
            studentQuizToken = obj;
            break;
          }
        }
      }

      if (!studentQuizToken) {
        throw new Error('Quiz token not found after payment — contact support');
      }

      console.log(`  🎟️  Quiz token: ${studentQuizToken._id}, symbol=${studentQuizToken.symbol}`);

      // STEP 4: Update request in DB
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
    } catch (error) {
      console.error('Payment error:', error);
      throw new InternalServerErrorException(`Payment failed: ${error.message}`);
    }
  }

  /**
   * Get student's access requests
   */
  async getStudentRequests(studentId: string) {
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

  /**
   * Get teacher's requests (all statuses, grouped by quiz)
   * Includes attempt status for STARTED requests so teacher can see if student submitted.
   */
  async getTeacherRequests(teacherId: string) {
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
        // Include the linked attempt so teacher can see if student submitted answers
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

  /**
   * Teacher claims entry fee payment
   *
   * Flow (from test - STEP 4):
   * 1. Get teacher's Computer instance
   * 2. Query for payment owned by teacher
   * 3. Sync payment contract
   * 4. Call payment.claim() to release satoshis
   * 5. Broadcast transaction
   */
  async claimPayment(requestId: string, teacherId: string) {
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

    if (!request) throw new NotFoundException('Request not found');
    if (request.quiz.teacherId !== teacherId) throw new ForbiddenException('Not your request');
    // Allow claiming from PAID or STARTED (student may have started before teacher collected)
    if (request.status !== 'PAID' && request.status !== 'FEE_CLAIMED' && request.status !== 'STARTED') {
      throw new BadRequestException(`Request is ${request.status}, cannot claim entry fee`);
    }
    // Don't double-claim
    if (request.feeClaimedAt) {
      throw new BadRequestException('Entry fee already claimed for this request');
    }
    if (!request.entryPaymentId) {
      throw new BadRequestException('Entry payment ID not recorded for this request');
    }

    // Initialize teacher's computer
    const teacherComputer = computerManager.getComputer(request.quiz.teacher.encryptedMnemonic);

    // query({ ids: [...] }) returns the current _rev for the contract — matches test pattern
    console.log(`🔍 Looking up entry fee payment: ${request.entryPaymentId}`);
    const [entryPaymentRev] = await teacherComputer.query({ ids: [request.entryPaymentId] });

    if (!entryPaymentRev) {
      throw new NotFoundException('Entry fee payment not found on chain');
    }

    const entryPayment = await teacherComputer.sync(entryPaymentRev);
    console.log(`✅ Found payment: ${entryPayment._id}, status: ${entryPayment.status}`);

    try {
      // Claim payment using PaymentHelper
      const paymentHelper = new PaymentHelper(teacherComputer, this.paymentModuleId);
      const { tx: claimTx } = await paymentHelper.claimPayment(entryPayment);

      await teacherComputer.broadcast(claimTx);
      await new Promise(resolve => setTimeout(resolve, 200)); // Wait for mempool

      // Mine block to confirm (same as test pattern)
      await this.mineBlocks(teacherComputer, 1);

      // Mark fee as claimed — set feeClaimedAt timestamp
      // If status is PAID, advance to FEE_CLAIMED; if already STARTED, keep STARTED
      await this.prisma.quizAccessRequest.update({
        where: { id: requestId },
        data: {
          feeClaimedAt: new Date(),
          ...(request.status === 'PAID' && { status: QuizAccessStatus.FEE_CLAIMED }),
        },
      });

      console.log('✅ Entry fee payment claimed!');

      return {
        success: true,
        message: 'Entry fee claimed successfully',
        paymentId: entryPayment._id,
        amount: entryPayment.amount.toString(),
      };
    } catch (error) {
      console.error('Claim payment error:', error);
      throw new InternalServerErrorException(`Failed to claim payment: ${error.message}`);
    }
  }

  /**
   * Student starts quiz attempt by burning quiz token
   *
   * Flow (from test - STEP 2 of Phase 2):
   * 1. Student creates QuizAttempt (temp, owned status)
   * 2. Student redeems (burns) quiz token using QuizRedemption.redeem()
   * 3. Quiz token amount becomes 0
   * 4. QuizAttempt status changes to 'redeemed'
   * 5. Student can now start taking the quiz
   */
  async startAttempt(requestId: string, studentId: string) {
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

    if (!request) throw new NotFoundException('Request not found');
    if (request.studentId !== studentId) throw new ForbiddenException('Not your request');
    // Allow starting from PAID or FEE_CLAIMED (teacher may have claimed the fee before student starts)
    if (request.status !== 'PAID' && request.status !== 'FEE_CLAIMED') {
      throw new BadRequestException(`Request is ${request.status}, must be PAID or FEE_CLAIMED`);
    }
    if (!request.quizTokenId) throw new BadRequestException('No quiz token found');
    if (new Date() > request.quiz.deadline) throw new BadRequestException('Quiz deadline passed');

    try {
      // Initialize student's computer
      // Get or create student's Computer instance (reused across all requests for this student)
      const studentComputer = computerManager.getComputer(request.student.encryptedMnemonic);

      // Get teacher's publicKey
      const teacher = await this.prisma.user.findUnique({
        where: { id: request.quiz.teacherId },
        select: { publicKey: true },
      });

      if (!teacher || !teacher.publicKey) {
        throw new BadRequestException('Teacher wallet not configured');
      }

      // STEP 0: Sync quiz token to get originalQuizId
      console.log('🔍 Syncing quiz token...');
      const quizTokenRevs = await studentComputer.query({ ids: [request.quizTokenId] });
      if (!quizTokenRevs || quizTokenRevs.length === 0) {
        throw new BadRequestException(`Quiz token not found on blockchain: ${request.quizTokenId}`);
      }
      const syncedQuizToken = await studentComputer.sync(quizTokenRevs[0]);
      console.log(`  🎟️  Quiz token synced: amount=${syncedQuizToken.amount}, symbol=${syncedQuizToken.symbol}`);

      if (syncedQuizToken.amount !== BigInt(1)) {
        throw new BadRequestException(`Invalid quiz token state: amount=${syncedQuizToken.amount} (expected 1). Token may have already been used.`);
      }

      // Use originalQuizId from token (points to the original quiz, not the minted copy)
      const correctQuizId = (syncedQuizToken as any).originalQuizId || syncedQuizToken._id;
      console.log(`  Original Quiz ID: ${correctQuizId}`);

      // STEP 1: Create QuizAttempt contract
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
      await new Promise(resolve => setTimeout(resolve, 200)); // Wait for mempool

      // Mine block to confirm (same as test pattern)
      await this.mineBlocks(studentComputer, 1);

      const tempAttempt = attemptEffect.res;
      console.log(`✅ QuizAttempt created: ${tempAttempt._id}`);

      // STEP 2: Re-sync both quiz token AND attempt to get latest _rev before redemption
      console.log('🔥 Redeeming quiz token (burning)...');
      const [latestAttemptRev] = await studentComputer.query({ ids: [tempAttempt._id] });
      const syncedAttempt = await studentComputer.sync(latestAttemptRev);

      // Re-sync quiz token to get latest _rev (token state may have changed after mining)
      const [latestQuizTokenRevForRedeem] = await studentComputer.query({ ids: [request.quizTokenId] });
      const syncedQuizTokenForRedeem = await studentComputer.sync(latestQuizTokenRevForRedeem);
      console.log(`  🎟️  Quiz token re-synced: amount=${syncedQuizTokenForRedeem.amount}, symbol=${syncedQuizTokenForRedeem.symbol}`);

      // STEP 3: Redeem (burn) quiz token
      const QuizRedemptionHelper = (await import('@bizz/contracts/deploy/QuizRedemption.deploy.js')).QuizRedemptionHelper;
      const redemptionHelper = new QuizRedemptionHelper(studentComputer, process.env.QUIZ_REDEMPTION_MODULE_ID);

      const { tx: redeemTx, effect: redeemEffect } = await redemptionHelper.redeemQuizToken(
        syncedQuizTokenForRedeem,
        syncedAttempt
      );

      await studentComputer.broadcast(redeemTx);
      await new Promise(resolve => setTimeout(resolve, 200)); // Wait for mempool

      // Mine block to confirm (same as test pattern)
      await this.mineBlocks(studentComputer, 1);

      const [burnedToken, validatedAttempt] = redeemEffect.res;
      console.log(`✅ Quiz token burned! Amount: ${burnedToken.amount}`);
      console.log(`✅ QuizAttempt validated: ${validatedAttempt._id}`);

      // Cache attempt in database with OWNED status (after redemption validation)
      // score and passed are null until the teacher reveals answers and we pre-grade
      const dbAttempt = await this.prisma.quizAttempt.create({
        data: {
          contractId: validatedAttempt._id,
          contractRev: validatedAttempt._rev,
          quizId: request.quiz.id,
          userId: request.studentId,
          status: 'OWNED', // Set to OWNED after token redemption validates the attempt
          score: null,
          passed: null,
        },
      });

      // Update request status to STARTED with database attemptId
      await this.prisma.quizAccessRequest.update({
        where: { id: requestId },
        data: {
          status: 'STARTED',
          startedAt: new Date(),
          attemptId: dbAttempt.id, // Use database ID, not blockchain contract ID
        },
      });

      return {
        success: true,
        message: 'Quiz started successfully',
        attemptId: dbAttempt.id, // Return database ID for frontend
        contractId: validatedAttempt._id, // Also return blockchain contract ID
        tokenBurned: true,
      };
    } catch (error) {
      throw new InternalServerErrorException(`Failed to start attempt: ${error.message}`);
    }
  }


}
