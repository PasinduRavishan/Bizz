import { Injectable, NotFoundException, ForbiddenException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaClient } from '@prisma/client';
import { Computer } from '@bitcoin-computer/lib';
import { CreateQuizDto, CreateQuizUIDto, RevealAnswersDto } from './dto';
import { computerManager } from '../../common/computer-manager';
import { uploadQuestionsToIPFS, hashAnswers, generateSalt } from '../../common/ipfs.service';

// Import contract helpers (deployed contracts)
import { Token, Quiz, QuizHelper } from '@bizz/contracts/deploy/Quiz.deploy.js';

/**
 * Compute a student's score by comparing their answer indices (from commitment string)
 * against the correct answer option texts using the stored question option arrays.
 *
 * Commitment format: "commitment-[0,2,1,3]-<timestamp>"
 * revealedAnswers: ["Paris", "Blue", "4"]        — plaintext correct answer texts
 * questions: [{ options: ["Rome","Paris",...] }, ...]
 *
 * For each question i:
 *   correctIdx = questions[i].options.indexOf(revealedAnswers[i])
 *   studentIdx = parsed from commitment
 *   correct++  if studentIdx === correctIdx
 */
function computeScore(
  answerCommitment: string | null,
  revealedAnswers: string[] | null,
  questions: Array<{ question: string; options: string[] }> | null,
): number {
  if (!answerCommitment) throw new Error('No answer commitment found');
  if (!revealedAnswers || revealedAnswers.length === 0) throw new Error('No revealed answers found');
  if (!questions || questions.length === 0) throw new Error('No questions found for scoring');

  const match = answerCommitment.match(/commitment-(\[[\d,\s]+\])-/);
  if (!match) throw new Error(`Cannot parse commitment format: ${answerCommitment.substring(0, 50)}`);

  let studentIndices: number[];
  try {
    studentIndices = JSON.parse(match[1]) as number[];
  } catch {
    throw new Error('Cannot parse answer indices from commitment');
  }

  if (studentIndices.length === 0) throw new Error('No answers found in commitment');

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

/**
 * QuizService - Blockchain-first quiz logic
 *
 * Architecture:
 * - Blockchain = Source of truth
 * - Database = Query cache only
 * - Contract helpers handle blockchain ops
 * - Module IDs from .env
 */
@Injectable()
export class QuizService {
  private prisma: PrismaClient;
  private quizModuleId: string | undefined;
  /** In-memory failure counter per quiz id — reset on successful reveal or server restart */
  private readonly revealFailures = new Map<string, number>();
  private readonly MAX_REVEAL_FAILURES = 3;

  constructor() {
    this.prisma = new PrismaClient();
    this.quizModuleId = process.env.QUIZ_MODULE_ID;

    if (!this.quizModuleId) {
      console.warn('⚠️ QUIZ_MODULE_ID not set in .env');
    }
  }

  /**
   * Mine blocks in regtest mode (same as TestHelper.mineBlocks)
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
   * Create quiz on blockchain
   */
  async create(teacherId: string, createQuizDto: CreateQuizDto) {
    const teacher = await this.prisma.user.findUnique({
      where: { id: teacherId },
      select: {
        id: true,
        encryptedMnemonic: true,
        publicKey: true,
        role: true,
      },
    });

    if (!teacher) throw new NotFoundException('Teacher not found');
    if (teacher.role !== 'TEACHER') throw new ForbiddenException('Only teachers can create quizzes');
    if (!teacher.encryptedMnemonic || !teacher.publicKey) throw new BadRequestException('Wallet not configured');

    try {
      // Get or create teacher's Computer instance (reused across all requests for this teacher)
      const teacherComputer = computerManager.getComputer(teacher.encryptedMnemonic);

      const quizHelper = new QuizHelper(teacherComputer, this.quizModuleId);
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
      await new Promise(resolve => setTimeout(resolve, 200)); // Wait for mempool

      // Mine blocks to confirm quiz creation
      await this.mineBlocks(teacherComputer, 1)

      const quizContract = effect.res;
      console.log(`✅ Quiz created: ${quizContract._id}`);

      // Cache in database
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
    } catch (error) {
      console.error('Quiz creation error:', error);
      throw new InternalServerErrorException(`Failed to create quiz: ${error.message}`);
    }
  }

  /**
   * Create quiz from UI (Frontend-friendly endpoint)
   *
   * Accepts user-friendly data from frontend and handles:
   * - Symbol generation from title
   * - IPFS upload for questions
   * - Answer hashing with salt
   * - Blockchain deployment
   */
  async createFromUI(teacherId: string, createQuizUIDto: CreateQuizUIDto) {
    console.log('📝 Creating quiz from UI data...');

    try {
      // 1. Generate symbol from title
      const symbol = createQuizUIDto.title
        ? createQuizUIDto.title.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 10)
        : 'QUIZ' + Date.now().toString().substring(0, 6);

      console.log(`  Symbol: ${symbol}`);

      // 2. Prepare questions for IPFS (without correct answers)
      const questionsForIPFS = createQuizUIDto.questions.map(q => ({
        question: q.question,
        options: q.options,
      }));

      // 3. Upload questions to IPFS
      console.log('  📤 Uploading questions to IPFS...');
      const questionHashIPFS = await uploadQuestionsToIPFS(questionsForIPFS);
      console.log(`  ✅ IPFS Hash: ${questionHashIPFS}`);

      // 4. Generate salt and hash answers
      const salt = generateSalt();
      console.log('  🔐 Hashing answers...');
      const answerHashes = hashAnswers(createQuizUIDto.correctAnswers, salt);
      console.log(`  ✅ Generated ${answerHashes.length} answer hashes`);

      // 5. Create blockchain-ready DTO
      const blockchainDto: CreateQuizDto = {
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

      // 6. Call the existing create method
      const result = await this.create(teacherId, blockchainDto);

      // 7. Store the salt, questions JSON, and plaintext correct answers in DB
      // correctAnswers must be the PLAINTEXT answers (not hashes) — used by revealAnswers fallback
      await this.prisma.quiz.update({
        where: { id: result.quiz.id },
        data: {
          salt,
          correctAnswers: createQuizUIDto.correctAnswers, // plaintext — needed for reveal fallback
          questions: questionsForIPFS as any, // Prisma Json field — store without correct answers
        },
      });

      console.log('✅ Quiz created from UI successfully!');

      return {
        success: true,
        quizId: result.quiz.contractId,
        quiz: result.quiz,
      };
    } catch (error) {
      console.error('❌ Quiz creation from UI error:', error);
      throw new InternalServerErrorException(`Failed to create quiz: ${error.message}`);
    }
  }

  /**
   * List quizzes from cache
   */
  async findAll(filters?: { status?: string; teacherId?: string }) {
    const quizzes = await this.prisma.quiz.findMany({
      where: {
        ...(filters?.status && { status: filters.status as any }),
        ...(filters?.teacherId && { teacherId: filters.teacherId }),
      },
      include: {
        teacher: {
          select: { id: true, name: true, email: true, address: true },
        },
        _count: {
          select: { attempts: true, accessRequests: true },
        },
        // Include minimal attempt data so the dashboard can show prize-waiting indicators
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

  /**
   * Get quiz (sync from blockchain)
   */
  async findOne(id: string, userId?: string) {
    const dbQuiz = await this.prisma.quiz.findUnique({
      where: { id },
      include: {
        teacher: {
          select: { id: true, name: true, email: true, encryptedMnemonic: true },
        },
        // Always return ALL attempts with student info — required for teacher reveal page
        // Individual student view is handled by quiz-attempt endpoints
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

    if (!dbQuiz) throw new NotFoundException('Quiz not found');

    try {
      // Get or create teacher's Computer instance (reused across all requests for this teacher)
      const computer = computerManager.getComputer(dbQuiz.teacher.encryptedMnemonic);

      const quizContract = await computer.sync(dbQuiz.contractRev);

      // Strip sensitive teacher fields before returning
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
    } catch (error) {
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

  /**
   * Reveal answers on blockchain.
   * answers and salt are optional — falls back to values stored in DB at quiz creation.
   *
   * After the blockchain reveal this method also pre-grades every COMMITTED attempt
   * in the database so the teacher's reveal page and the student dashboard immediately
   * show the correct score / passed status.  The actual blockchain QuizAttempt.verify()
   * call is still performed later by the student (from the prize page), but the DB
   * fields are pre-populated here so the UI is never stale.
   */
  async revealAnswers(quizId: string, teacherId: string, revealDto: RevealAnswersDto) {
    const dbQuiz = await this.prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        teacher: {
          select: { id: true, encryptedMnemonic: true },
        },
        // Load committed attempts so we can pre-grade them
        attempts: {
          where: { status: 'COMMITTED' },
          select: {
            id: true,
            answerCommitment: true,
          },
        },
      },
    });

    if (!dbQuiz) throw new NotFoundException('Quiz not found');
    if (dbQuiz.teacherId !== teacherId) throw new ForbiddenException('Only creator can reveal');

    // Resolve answers and salt: prefer DTO values, fall back to DB-stored values from quiz creation
    const answers: string[] = (revealDto.answers && revealDto.answers.length > 0)
      ? revealDto.answers
      : (dbQuiz.correctAnswers as string[] | null) ?? [];

    const salt: string = (revealDto.salt && revealDto.salt.trim() !== '')
      ? revealDto.salt
      : (dbQuiz.salt ?? '');

    if (!answers || answers.length === 0) {
      throw new BadRequestException('No answers found. Please provide answers or recreate the quiz.');
    }
    if (!salt) {
      throw new BadRequestException('No salt found. Please provide salt or recreate the quiz.');
    }

    try {
      // Get or create teacher's Computer instance (reused across all requests for this teacher)
      const computer = computerManager.getComputer(dbQuiz.teacher.encryptedMnemonic);

      console.log('🔓 Revealing answers...');
      console.log(`  Using ${answers.length} answers from ${revealDto.answers?.length ? 'request body' : 'database'}`);

      // EXACT PATTERN from tbc20.test.ts lines 510-529:
      // 1. Query latest quiz state
      const [latestQuizRev] = await computer.query({ ids: [dbQuiz.contractId] })
      const syncedQuiz = await computer.sync(latestQuizRev)

      // Track final contractRev — updated after broadcast if we actually reveal
      let contractRev = syncedQuiz._rev;

      if (syncedQuiz.status === 'revealed') {
        // Already revealed on-chain (e.g. a previous cron run broadcast but crashed before
        // updating the DB).  Skip the broadcast — just sync DB state + pre-grade below.
        console.log('ℹ️  Quiz already revealed on blockchain — syncing DB and pre-grading...');
      } else if (syncedQuiz.status !== 'active') {
        throw new BadRequestException(`Status is ${syncedQuiz.status}`);
      } else {
        // 2. Use encodeCall (NOT encode with obj)
        const { tx: revealTx } = await computer.encodeCall({
          target: syncedQuiz,
          property: 'revealAnswers',
          args: [answers, salt],
          mod: process.env.QUIZ_MODULE_ID
        })

        // 3. Broadcast
        await computer.broadcast(revealTx)

        // 4. Wait for mempool (200ms like TestHelper.waitForMempool)
        await new Promise(resolve => setTimeout(resolve, 200))

        // 5. Mine to confirm
        await this.mineBlocks(computer, 1)

        // 6. Sync to get updated quiz
        const [updatedQuizRev] = await computer.query({ ids: [dbQuiz.contractId] })
        const updatedQuiz = await computer.sync(updatedQuizRev)
        contractRev = updatedQuiz._rev;
      }

      console.log('✅ Answers revealed on blockchain');

      // Update database with fresh state
      await this.prisma.quiz.update({
        where: { id: quizId },
        data: {
          status: 'REVEALED',
          revealedAnswers: answers,
          salt,
          contractRev,
        },
      });

      // ── Pre-grade all COMMITTED attempts ──────────────────────────────────
      // Load questions from DB (stored at quiz creation by createFromUI)
      const quizWithQuestions = await this.prisma.quiz.findUnique({
        where: { id: quizId },
        select: { questions: true, passThreshold: true, prizePool: true },
      });
      const questions = quizWithQuestions?.questions as Array<{ question: string; options: string[] }> | null;
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
          if (passed) passedCount++;
          console.log(`  📊 Pre-graded attempt ${attempt.id}: score=${score}%, passed=${passed}`);
        } catch (e) {
          // Don't fail the whole reveal if one attempt can't be graded
          console.warn(`  ⚠️  Could not pre-grade attempt ${attempt.id}: ${(e as Error).message}`);
        }
      }

      // ── Calculate and store per-winner prize share ─────────────────────────
      // prize is divided equally among all passing students (floor division).
      // The winner count is final here because ALL committed attempts are graded
      // before any student calls verifyAttempt() (which requires REVEALED status).
      if (passedCount > 0 && quizWithQuestions?.prizePool) {
        const prizePerWinner = quizWithQuestions.prizePool / BigInt(passedCount);
        await this.prisma.quiz.update({
          where: { id: quizId },
          data: { winnerCount: passedCount, prizePerWinner },
        });
        console.log(`💰 Multi-winner distribution: ${passedCount} winner(s) × ${prizePerWinner.toString()} sats each (pool: ${quizWithQuestions.prizePool.toString()} sats)`);
      } else {
        // No winners — store 0 winners, prizePerWinner stays null
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
    } catch (error) {
      console.error('Reveal error:', error);
      throw new InternalServerErrorException(`Reveal failed: ${error.message}`);
    }
  }

  /**
   * Auto-reveal cron job — runs every minute.
   *
   * Only processes quizzes whose teacher has a valid encryptedMnemonic (i.e. properly
   * set-up accounts).  Old test/legacy quizzes whose teachers have no wallet are
   * skipped at the DB level so they never enter the loop.
   *
   * Additional safeguard: an in-memory failure counter caps retries at
   * MAX_REVEAL_FAILURES per quiz.  After that the quiz is marked COMPLETED so it
   * is never picked up again, preventing the infinite-loop seen with old quizzes.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async autoRevealExpiredQuizzes(): Promise<void> {
    try {
      // Only find quizzes whose teacher has a mnemonic — old/legacy quizzes without
      // one are permanently excluded from auto-reveal at the query level.
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

      if (expiredQuizzes.length === 0) return;

      console.log(`⏰ Auto-reveal: found ${expiredQuizzes.length} eligible expired quiz(zes)`);

      for (const quiz of expiredQuizzes) {
        const failures = this.revealFailures.get(quiz.id) ?? 0;

        // After MAX_REVEAL_FAILURES consecutive failures mark COMPLETED so the cron
        // never picks this quiz up again.
        if (failures >= this.MAX_REVEAL_FAILURES) {
          console.warn(
            `⚠️  Quiz ${quiz.id} ("${quiz.title}") failed auto-reveal ${failures} time(s) — ` +
            `marking COMPLETED to stop retrying.`
          );
          await this.prisma.quiz.update({ where: { id: quiz.id }, data: { status: 'COMPLETED' } });
          this.revealFailures.delete(quiz.id);
          continue;
        }

        try {
          console.log(`🔓 Auto-revealing quiz: ${quiz.id} ("${quiz.title}") — attempt ${failures + 1}/${this.MAX_REVEAL_FAILURES}`);

          // revealAnswers() falls back to DB-stored answers + salt automatically
          await this.revealAnswers(quiz.id, quiz.teacher.id, { answers: [], salt: '' });

          // Success — clear any previous failure count
          this.revealFailures.delete(quiz.id);
          console.log(`✅ Auto-reveal complete for quiz: ${quiz.id}`);
        } catch (err) {
          const newCount = failures + 1;
          this.revealFailures.set(quiz.id, newCount);
          console.error(
            `❌ Auto-reveal failed for quiz ${quiz.id} (${newCount}/${this.MAX_REVEAL_FAILURES}):`,
            (err as Error).message,
          );
          // Continue with remaining quizzes
        }
      }
    } catch (err) {
      console.error('❌ Auto-reveal cron job error:', (err as Error).message);
    }
  }

  /**
   * Delete quiz (cache only)
   */
  async remove(quizId: string, teacherId: string) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId },
      include: { _count: { select: { attempts: true } } },
    });

    if (!quiz) throw new NotFoundException('Quiz not found');
    if (quiz.teacherId !== teacherId) throw new ForbiddenException('Only creator can delete');
    if (quiz._count.attempts > 0) throw new BadRequestException('Cannot delete with attempts');

    await this.prisma.quiz.delete({ where: { id: quizId } });

    return { success: true, message: 'Deleted from cache' };
  }

  async onModuleDestroy() {
    await this.prisma.$disconnect();
  }
}
