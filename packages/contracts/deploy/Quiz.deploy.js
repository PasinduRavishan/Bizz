// Deployment-ready Quiz contract (no imports, Contract is available in Bitcoin Computer context)
// Auto-generated from TypeScript source - DO NOT EDIT MANUALLY
// Edit the TypeScript file in src/Quiz.ts instead

// TypeScript version for local development (not used for deployment)
// Bitcoin Computer requires JavaScript without imports
// For deployment, use the JS version or strip types
// @ts-expect-error - Bitcoin Computer library type definitions issue
export class Payment extends Contract {
    // Contract base properties
    _id;
    _rev;
    _owners;
    _satoshis;
    // Payment properties
    recipient;
    amount;
    purpose;
    reference;
    status;
    createdAt;
    claimedAt;
    constructor(recipient, amount, purpose, reference) {
        if (!recipient)
            throw new Error('Recipient required');
        if (amount < BigInt(546))
            throw new Error('Amount must be at least 546 satoshis');
        if (!purpose)
            throw new Error('Purpose required');
        super({
            // DON'T set _owners here - let Bitcoin Computer set it to the creator
            // This allows atomic swaps where creator != recipient
            _satoshis: amount,
            recipient,
            amount,
            purpose,
            reference,
            status: 'unclaimed',
            createdAt: Date.now(),
            claimedAt: null
        });
    }
    transfer(to) {
        this._owners = [to];
    }
    claim() {
        if (this.status === 'claimed') {
            throw new Error('Payment already claimed');
        }
        this._satoshis = BigInt(546);
        this.status = 'claimed';
        this.claimedAt = Date.now();
    }
    getInfo() {
        return {
            paymentId: this._id,
            recipient: this.recipient,
            amount: this.amount,
            purpose: this.purpose,
            reference: this.reference,
            status: this.status,
            createdAt: this.createdAt,
            claimedAt: this.claimedAt,
            canClaim: this.status === 'unclaimed'
        };
    }
}
export class Quiz extends Contract {
    // Contract base properties
    _id;
    _rev;
    _owners;
    _satoshis;
    // Quiz properties
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
    constructor(teacher, questionHashIPFS, answerHashes, prizePool, entryFee, passThreshold, deadline, teacherRevealDeadline = null) {
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
        // Note: Don't validate deadline against Date.now() in constructor
        // because when syncing old contracts, the deadline will be in the past
        // Validation happens in methods that use the deadline
        // If not provided, default to 48 hours after deadline
        const TEACHER_REVEAL_WINDOW = 48 * 3600 * 1000;
        const finalTeacherRevealDeadline = teacherRevealDeadline || (deadline + TEACHER_REVEAL_WINDOW);
        super({
            _owners: [teacher],
            _satoshis: BigInt(546),
            teacher,
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
            version: '1.0.0'
        });
    }
    getInfo() {
        return {
            quizId: this._id,
            quizRev: this._rev,
            teacher: this.teacher,
            questionHashIPFS: this.questionHashIPFS,
            questionCount: this.questionCount,
            entryFee: this.entryFee,
            prizePool: this._satoshis,
            passThreshold: this.passThreshold,
            deadline: this.deadline,
            teacherRevealDeadline: this.teacherRevealDeadline,
            status: this.status,
            createdAt: this.createdAt,
            isActive: this.status === 'active' && Date.now() < this.deadline,
            canReveal: Date.now() >= this.deadline && Date.now() < this.teacherRevealDeadline,
            isExpired: Date.now() > this.teacherRevealDeadline && this.status === 'active'
        };
    }
    revealAnswers(answers, salt) {
        if (!this._owners.includes(this.teacher)) {
            throw new Error('Only teacher can reveal answers');
        }
        if (this.status !== 'active') {
            throw new Error('Quiz is not in active status');
        }
        // Note: Deadline checks commented out to avoid issues during blockchain replay
        // In production, these should be enforced at the application layer before calling
        // if (Date.now() < this.deadline) {
        //   throw new Error('Quiz is still active')
        // }
        // if (Date.now() > this.teacherRevealDeadline) {
        //   throw new Error('Teacher reveal deadline has passed')
        // }
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
        // Note: Distribution deadline check removed to avoid replay issues
        // if (Date.now() > this.distributionDeadline) {
        //   throw new Error('Distribution deadline passed')
        // }
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
}
//# sourceMappingURL=Quiz.js.map