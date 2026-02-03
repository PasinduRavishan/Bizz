// TypeScript version for local development (not used for deployment)
// Bitcoin Computer requires JavaScript without imports
// For deployment, use the JS version or strip types
import { Token } from './Token';
/**
 * Quiz - Fungible Token (TBC20)
 *
 * THE QUIZ ITSELF IS NOW A FUNGIBLE TOKEN!
 *
 * Key Changes from Previous Architecture:
 * - Quiz extends Token (not Contract)
 * - Quiz is fungible - teacher can mint unlimited on-demand
 * - Students buy Quiz tokens via exec (pay entry fee → get quiz token)
 * - Students redeem Quiz token → creates QuizAttempt
 * - Quiz token gets burned during redemption
 *
 * Flow:
 * 1. Teacher creates Quiz fungible token (mints initial supply or 0)
 * 2. Student requests quiz access
 * 3. Teacher mints Quiz token on-demand (via transfer)
 * 4. QuizAccess.exec() swaps quiz token for entry fee payment (atomic)
 * 5. Student redeems Quiz token → creates QuizAttempt (burns quiz token)
 * 6. Student submits answers in QuizAttempt
 * 7. Rest continues (reveal, scoring, prize swap)
 */
export class Quiz extends Token {
    // Token properties (inherited from Token base class)
    // amount!: bigint
    // symbol!: string
    // _owners!: string[]
    // Contract base properties (inherited from Token → Contract)
    _id;
    _rev;
    _satoshis;
    // Quiz-specific metadata properties
    teacher;
    questionHashIPFS;
    answerHashes;
    questionCount;
    entryFee;
    prizePool;
    passThreshold;
    platformFee;
    deadline;
    teacherRevealDeadline;
    distributionDeadline;
    distributedAt;
    status;
    revealedAnswers;
    salt;
    winners;
    createdAt;
    version;
    /**
     * Constructor - Creates Quiz as fungible token
     *
     * @param to - Token owner (teacher for new quiz, student for transferred tokens)
     * @param initialSupply - Initial supply of quiz tokens (0 for on-demand minting)
     * @param symbol - Token symbol (e.g., "MATH101")
     * @param teacher - Teacher's public key (metadata, not ownership)
     * @param questionHashIPFS - IPFS hash of encrypted questions
     * @param answerHashes - Array of hashed answers
     * @param prizePool - Total prize pool in satoshis
     * @param entryFee - Entry fee per student in satoshis
     * @param passThreshold - Pass percentage (0-100)
     * @param deadline - Quiz deadline timestamp
     * @param teacherRevealDeadline - Deadline for teacher to reveal answers
     * @param originalQuizId - Original quiz ID (for transferred tokens, empty string for new quiz)
     */
    constructor(to, initialSupply, symbol, teacher, questionHashIPFS, answerHashes, prizePool, entryFee, passThreshold, deadline, teacherRevealDeadline = null, originalQuizId = '') {
        // Validation
        if (!to)
            throw new Error('Owner required');
        if (!teacher)
            throw new Error('Teacher public key required');
        if (!questionHashIPFS)
            throw new Error('Question hash required');
        if (!Array.isArray(answerHashes) || answerHashes.length === 0) {
            throw new Error('Answer hashes must be a non-empty array');
        }
        if (prizePool < BigInt(10000)) {
            throw new Error('Prize pool must be at least 10,000 satoshis');
        }
        if (entryFee < BigInt(5000)) {
            throw new Error('Entry fee must be at least 5,000 satoshis');
        }
        if (passThreshold < 0 || passThreshold > 100) {
            throw new Error('Pass threshold must be between 0 and 100');
        }
        // If not provided, default to 48 hours after deadline
        const TEACHER_REVEAL_WINDOW = 48 * 3600 * 1000;
        const finalTeacherRevealDeadline = teacherRevealDeadline || (deadline + TEACHER_REVEAL_WINDOW);
        // Call Token constructor with additional quiz properties
        super(to, initialSupply, symbol, {
            teacher, // Metadata: who created the quiz
            originalQuizId, // Empty for new quiz, preserved for transfers
            questionHashIPFS,
            answerHashes,
            questionCount: answerHashes.length,
            entryFee,
            prizePool,
            passThreshold,
            platformFee: 0.02,
            deadline,
            teacherRevealDeadline: finalTeacherRevealDeadline,
            distributionDeadline: 0,
            status: 'active',
            revealedAnswers: null,
            salt: null,
            winners: [],
            createdAt: Date.now(),
            version: '2.0.0' // Version 2.0 - Quiz as fungible token
        });
    }
    /**
     * Transfer quiz tokens to recipient (TBC20 pattern)
     * Creates new UTXO for recipient, reduces this token's amount
     * This enables on-demand minting: teacher can mint and distribute quiz tokens
     *
     * @param recipient - Recipient's public key
     * @param amount - Amount to transfer
     * @returns New Quiz token UTXO for recipient
     */
    transfer(recipient, amount) {
        if (!recipient)
            throw new Error('Recipient required');
        if (amount <= 0n)
            throw new Error('Amount must be positive');
        if (this.amount < amount)
            throw new Error('Insufficient balance');
        // Reduce this UTXO's balance
        this.amount -= amount;
        // Determine originalQuizId: use existing one or this._id for first transfer
        const quizId = this.originalQuizId || this._id;
        // Create new Quiz token UTXO for recipient (on-demand minting pattern)
        // Pass all quiz metadata INCLUDING originalQuizId and teacher to the new token
        return new Quiz(recipient, // Recipient becomes the new owner
        amount, this.symbol, this.teacher, // Preserve original teacher (metadata)
        this.questionHashIPFS, this.answerHashes, this.prizePool, this.entryFee, this.passThreshold, this.deadline, this.teacherRevealDeadline, quizId // Preserve original quiz ID
        );
    }
    /**
     * Burn quiz token (destroy it)
     * Used during redemption to convert quiz token into QuizAttempt
     */
    burn() {
        if (this.amount !== 1n) {
            throw new Error('Can only burn exactly 1 quiz token');
        }
        this.amount = 0n;
    }
    /**
     * Reveal answers (called by teacher after deadline)
     */
    revealAnswers(answers, salt) {
        if (!this._owners.includes(this.teacher)) {
            throw new Error('Only teacher can reveal answers');
        }
        if (this.status !== 'active') {
            throw new Error('Quiz is not in active status');
        }
        if (answers.length !== this.answerHashes.length) {
            throw new Error('Answer count does not match');
        }
        this.revealedAnswers = answers;
        this.salt = salt;
        this.status = 'revealed';
        this.distributionDeadline = Date.now() + (24 * 60 * 60 * 1000);
    }
    /**
     * Distribute prizes to winners
     */
    distributePrizes(winners = []) {
        if (this.status !== 'revealed') {
            throw new Error('Quiz must be revealed first');
        }
        if (!this._owners.includes(this.teacher)) {
            throw new Error('Only teacher can distribute prizes');
        }
        if (!Array.isArray(winners) || winners.length === 0) {
            this.status = 'completed';
            this.distributedAt = Date.now();
            return;
        }
        // DEFERRED PAYMENT MODEL:
        // Store winner metadata only - Payment contracts created separately
        // Prize pool stays as metadata, not locked in UTXO
        this.winners = winners;
        this.status = 'completed';
        this.distributedAt = Date.now();
    }
    markDistributionComplete() {
        if (this.status !== 'distributing') {
            throw new Error('Quiz must be in distributing status');
        }
        this.status = 'completed';
    }
    complete(winners) {
        if (this.status !== 'revealed') {
            throw new Error('Quiz must be revealed first');
        }
        this.winners = winners;
        this.status = 'completed';
    }
    triggerRefund() {
        if (this.status !== 'active') {
            throw new Error('Quiz is not in active status');
        }
        if (Date.now() <= this.teacherRevealDeadline) {
            throw new Error('Teacher still has time to reveal');
        }
        this.status = 'refunded';
    }
    markAbandoned() {
        const now = Date.now();
        if (this.status === 'active' && now > this.teacherRevealDeadline) {
            this.status = 'abandoned';
            return;
        }
        if (this.status === 'revealed' && now > this.distributionDeadline) {
            this.status = 'abandoned';
            return;
        }
        throw new Error('Cannot mark as abandoned yet');
    }
    getInfo() {
        return {
            quizId: this._id,
            quizRev: this._rev,
            teacher: this.teacher,
            questionHashIPFS: this.questionHashIPFS,
            questionCount: this.questionCount,
            entryFee: this.entryFee,
            prizePool: this.prizePool,
            passThreshold: this.passThreshold,
            deadline: this.deadline,
            teacherRevealDeadline: this.teacherRevealDeadline,
            status: this.status,
            createdAt: this.createdAt,
            // Token info
            tokenAmount: this.amount,
            symbol: this.symbol,
            isActive: this.status === 'active' && Date.now() < this.deadline,
            canReveal: Date.now() >= this.deadline && Date.now() < this.teacherRevealDeadline,
            isExpired: Date.now() > this.teacherRevealDeadline && this.status === 'active'
        };
    }
}
//# sourceMappingURL=Quiz.js.map