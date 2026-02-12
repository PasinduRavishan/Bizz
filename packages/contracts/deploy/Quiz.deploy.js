// Deployment-ready Quiz contract (no imports, Contract is available in Bitcoin Computer context)
// Auto-generated from TypeScript source - DO NOT EDIT MANUALLY
// Edit the TypeScript file in src/Quiz.ts instead

/**
 * Token - Base class for TBC20 fungible tokens
 *
 * Implements the standard TBC20 pattern from Bitcoin Computer monorepo.
 * Pattern: class Token extends Contract with amount, symbol, _owners
 *
 * All fungible tokens should extend this base class.
 */
export class Token extends Contract {
    constructor(to, amount, symbol, additionalProps) {
        if (!to)
            throw new Error('Recipient public key required');
        if (amount <= 0n)
            throw new Error('Amount must be positive');
        if (!symbol)
            throw new Error('Symbol required');
        super({
            _owners: [to],
            _satoshis: BigInt(546), // Dust limit - token value is in amount, not satoshis
            amount,
            symbol,
            ...additionalProps
        });
    }
    mint(to, amount) {
        if (!to)
            throw new Error('Recipient required');
        if (amount <= 0n)
            throw new Error('Amount must be positive');
        throw new Error('mint() must be implemented by subclass');
    }
    transfer(recipient, amount) {
        if (!recipient)
            throw new Error('Recipient required');
        if (amount <= 0n)
            throw new Error('Amount must be positive');
        if (this.amount < amount)
            throw new Error('Insufficient balance');
        this.amount -= amount;
        throw new Error('transfer() must be implemented by subclass');
    }
    burn() {
        if (this.amount <= 0n) {
            throw new Error('No tokens to burn');
        }
        this.amount = 0n;
    }
    balanceOf() {
        return this.amount;
    }
    totalSupply() {
        return this.amount;
    }
}


export class Quiz extends Token {
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
        const TEACHER_REVEAL_WINDOW = 48 * 3600 * 1000;
        const finalTeacherRevealDeadline = teacherRevealDeadline || (deadline + TEACHER_REVEAL_WINDOW);
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
            version: '2.0.0'
        });
    }
    mint(to, amount) {
        const quizId = this.originalQuizId || this._id;
        return new Quiz(to, // Recipient becomes the new owner
        amount, this.symbol, this.teacher, // Preserve original teacher (metadata)
        this.questionHashIPFS, this.answerHashes, this.prizePool, this.entryFee, this.passThreshold, this.deadline, this.teacherRevealDeadline, quizId // Preserve original quiz ID
        );
    }
    transfer(recipient, amount) {
        this.amount -= amount;
        const quizId = this.originalQuizId || this._id;
        return new Quiz(recipient, // Recipient becomes the new owner
        amount, this.symbol, this.teacher, // Preserve original teacher (metadata)
        this.questionHashIPFS, this.answerHashes, this.prizePool, this.entryFee, this.passThreshold, this.deadline, this.teacherRevealDeadline, quizId // Preserve original quiz ID
        );
    }
    burn() {
        this.amount = 0n;
    }
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
        }
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
        }
        if (this.status === 'revealed' && now > this.distributionDeadline) {
            this.status = 'abandoned';
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
            tokenAmount: this.amount,
            symbol: this.symbol,
            isActive: this.status === 'active' && Date.now() < this.deadline,
            canReveal: Date.now() >= this.deadline && Date.now() < this.teacherRevealDeadline,
            isExpired: Date.now() > this.teacherRevealDeadline && this.status === 'active'
        };
    }
}
export class QuizHelper {
    constructor(computer, mod) {
        this.computer = computer;
        this.mod = mod;
    }
    async deploy(Token, Quiz) {
        this.mod = await this.computer.deploy(`export ${Token}\nexport ${Quiz}`);
        return this.mod;
    }
    validateQuizParams(params) {
        if (!params.teacherPubKey)
            throw new Error('Teacher public key required');
        if (!params.questionHashIPFS)
            throw new Error('Question hash required');
        if (!Array.isArray(params.answerHashes) || params.answerHashes.length === 0) {
            throw new Error('Answer hashes must be a non-empty array');
        }
        if (params.prizePool < BigInt(10000)) {
            throw new Error('Prize pool must be at least 10,000 satoshis');
        }
        if (params.entryFee < BigInt(5000)) {
            throw new Error('Entry fee must be at least 5,000 satoshis');
        }
        if (params.passThreshold < 0 || params.passThreshold > 100) {
            throw new Error('Pass threshold must be between 0 and 100');
        }
    }
    async createQuiz(params) {
        this.validateQuizParams(params);
        const { tx, effect } = await this.computer.encode({
            mod: this.mod,
            exp: `new Quiz("${params.teacherPubKey}", BigInt(${params.initialSupply}), "${params.symbol}", "${params.teacherPubKey}", "${params.questionHashIPFS}", ${JSON.stringify(params.answerHashes)}, BigInt(${params.prizePool}), BigInt(${params.entryFee}), ${params.passThreshold}, ${params.deadline}, ${params.teacherRevealDeadline})`
        });
        return { tx, effect };
    }
}
