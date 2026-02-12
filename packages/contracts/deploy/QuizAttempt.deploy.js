// Deployment-ready QuizAttempt contract (no imports, Contract is available in Bitcoin Computer context)
// Auto-generated from TypeScript source - DO NOT EDIT MANUALLY
// Edit the TypeScript file in src/QuizAttempt.ts instead

export class QuizAttempt extends Contract {
    constructor(owner, // Student who owns this attempt
    quizRef, answerCommitment, // Empty at creation, filled after redemption
    entryFee, quizTeacher) {
        const initialStatus = owner === quizTeacher ? 'available' : 'owned';
        super({
            _owners: [owner],
            _satoshis: BigInt(546), // Dust only
            student: owner, // Will be updated after transfer in exec flow
            quizRef,
            answerCommitment,
            quizTeacher,
            entryFee,
            score: null,
            passed: null,
            status: initialStatus,
            submitTimestamp: Date.now(),
            claimedAt: null,
            version: '2.0.0',
            isRedeemed: false // Default false - only true after quiz token redemption
        });
    }
    markAsRedeemed() {
        this.isRedeemed = true;
    }
    transfer(newOwner) {
        this._owners = [newOwner];
        this.student = newOwner;
        this.status = 'owned';
    }
    submitCommitment(commitment) {
        this.answerCommitment = commitment;
        this.status = 'committed';
        this.submitTimestamp = Date.now();
    }
    verify(score, passed) {
        this.score = score;
        this.passed = passed;
        this.status = 'verified';
    }
    fail() {
        this.status = 'failed';
        this.passed = false;
    }
    claimPrize() {
        this.status = 'prize_claimed';
        this.claimedAt = Date.now();
    }
    claimRefund(quiz) {
        this.status = 'refunded';
        this._satoshis = BigInt(546);
    }
    getInfo() {
        return {
            attemptId: this._id,
            student: this.student,
            quizRef: this.quizRef,
            status: this.status,
            submitTimestamp: this.submitTimestamp,
            score: this.score,
            passed: this.passed,
            answerCommitment: this.answerCommitment
        };
    }
}
export class QuizAttemptHelper {
    constructor(computer, mod) {
        this.computer = computer;
        this.mod = mod;
    }
    async deploy() {
        this.mod = await this.computer.deploy(`export ${QuizAttempt}`);
        return this.mod;
    }
    validateAttemptParams(params) {
        if (!params.studentPubKey)
            throw new Error('Owner required');
        if (!params.quizId)
            throw new Error('Quiz reference required');
        if (params.entryFee < BigInt(5000)) {
            throw new Error('Entry fee must be at least 5,000 satoshis');
        }
        if (!params.teacher)
            throw new Error('Quiz teacher public key required');
    }
    validateSubmitCommitment(attempt, commitment) {
        if (attempt.status !== 'owned') {
            throw new Error('Must own attempt before submitting answers');
        }
        if (!attempt.isRedeemed) {
            throw new Error('Must redeem quiz token before submitting answers');
        }
        if (!commitment) {
            throw new Error('Commitment required');
        }
    }
    validateVerify(attempt) {
        if (attempt.status !== 'committed') {
            throw new Error('Attempt must be committed before verification');
        }
    }
    validateClaimPrize(attempt) {
        if (attempt.status !== 'verified') {
            throw new Error('Attempt must be verified before claiming prize');
        }
        if (!attempt.passed) {
            throw new Error('Only passing attempts can claim prizes');
        }
    }
    validateClaimRefund(attempt, quiz) {
        if (quiz.status !== 'abandoned') {
            throw new Error('Cannot claim refund: quiz not abandoned');
        }
        if (attempt.status === 'refunded') {
            throw new Error('Refund already claimed');
        }
        if (!attempt._owners.includes(attempt.student)) {
            throw new Error('Only the student can claim refund');
        }
    }
    async createQuizAttempt(params) {
        this.validateAttemptParams(params);
        const { tx, effect } = await this.computer.encode({
            mod: this.mod,
            exp: `new QuizAttempt("${params.studentPubKey}", "${params.quizId}", "${params.answerCommitment}", BigInt(${params.entryFee}), "${params.teacher}")`
        });
        return { tx, effect };
    }
    async submitCommitment(attempt, commitment) {
        const syncedAttempt = await this.computer.sync(attempt._rev);
        this.validateSubmitCommitment(syncedAttempt, commitment);
        const { tx, effect } = await this.computer.encodeCall({
            target: syncedAttempt,
            property: 'submitCommitment',
            args: [commitment],
            mod: this.mod
        });
        return { tx, effect };
    }
    async verifyAttempt(attempt, answers, nonce, revealedAnswers, passThreshold) {
        const syncedAttempt = await this.computer.sync(attempt._rev);
        this.validateVerify(syncedAttempt);
        const { tx, effect } = await this.computer.encodeCall({
            target: syncedAttempt,
            property: 'verify',
            args: [answers, nonce, revealedAnswers, passThreshold],
            mod: this.mod
        });
        return { tx, effect };
    }
}
