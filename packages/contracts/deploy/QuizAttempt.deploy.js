// Deployment-ready QuizAttempt contract (no imports, Contract is available in Bitcoin Computer context)
// Auto-generated from TypeScript source - DO NOT EDIT MANUALLY
// Edit the TypeScript file in src/QuizAttempt.ts instead

export class QuizAttempt extends Contract {
    constructor(student, quizRef, answerCommitment, entryFee, quizTeacher) {
        if (!student)
            throw new Error('Student public key required');
        if (!quizRef)
            throw new Error('Quiz reference required');
        if (!answerCommitment)
            throw new Error('Answer commitment required');
        if (entryFee < BigInt(5000)) {
            throw new Error('Entry fee must be at least 5,000 satoshis');
        }
        if (!quizTeacher)
            throw new Error('Quiz teacher public key required');
        super({
            _owners: [student],
            _satoshis: BigInt(546),
            student,
            quizRef,
            answerCommitment,
            entryFee, // Stored as metadata only
            quizTeacher,
            revealedAnswers: null,
            nonce: null,
            score: null,
            passed: null,
            status: 'committed',
            submitTimestamp: Date.now(),
            revealTimestamp: null,
            claimedAt: null,
            version: '1.0.0'
        });
    }
    reveal(answers, nonce) {
        if (this.status !== 'committed') {
            throw new Error('Attempt already revealed or verified');
        }
        if (!Array.isArray(answers) || answers.length === 0) {
            throw new Error('Answers must be a non-empty array');
        }
        if (!nonce) {
            throw new Error('Nonce is required');
        }
        this.revealedAnswers = answers;
        this.nonce = nonce;
        this.status = 'revealed';
        this.revealTimestamp = Date.now();
    }
    verify(score, passed) {
        if (this.status !== 'committed' && this.status !== 'revealed') {
            throw new Error('Attempt must be committed or revealed before verification');
        }
        this.score = score;
        this.passed = passed;
        this.status = 'verified';
    }
    fail() {
        this.status = 'failed';
        this.passed = false;
    }
    transferOwnershipToTeacher(quiz) {
        if (quiz.status !== 'completed') {
            throw new Error('Cannot transfer ownership: quiz not completed');
        }
        if (this.status === 'ownership-transferred' || this.status === 'forfeited') {
            throw new Error('Ownership already transferred');
        }
        this._owners = [this.quizTeacher];
        this.status = 'ownership-transferred';
    }
    claimEntryFee() {
        if (this.status !== 'ownership-transferred') {
            throw new Error('Ownership must be transferred first');
        }
        this._satoshis = BigInt(546);
        this.status = 'forfeited';
    }
    collectFee() {
        if (!['committed', 'verified', 'failed'].includes(this.status)) {
            throw new Error('Cannot collect fee from this status');
        }
        if (this.status === 'fee_collected') {
            throw new Error('Fee already collected');
        }
        this.status = 'fee_collected';
    }
    claimPrize() {
        if (this.status !== 'verified') {
            throw new Error('Attempt must be verified before claiming prize');
        }
        if (!this.passed) {
            throw new Error('Only passing attempts can claim prizes');
        }
        this.status = 'prize_claimed';
        this.claimedAt = Date.now();
    }
    claimRefund(quiz) {
        if (quiz.status !== 'abandoned') {
            throw new Error('Cannot claim refund: quiz not abandoned');
        }
        if (this.status === 'refunded') {
            throw new Error('Refund already claimed');
        }
        if (!this._owners.includes(this.student)) {
            throw new Error('Only the student can claim refund');
        }
        this.status = 'refunded';
        this._satoshis = BigInt(546); // Reduce to dust, rest goes to student
    }
    getInfo() {
        return {
            attemptId: this._id,
            student: this.student,
            quizRef: this.quizRef,
            status: this.status,
            submitTimestamp: this.submitTimestamp,
            revealTimestamp: this.revealTimestamp,
            score: this.score,
            passed: this.passed,
            hasRevealed: this.status !== 'committed',
            revealedAnswers: this.revealedAnswers
        };
    }
}
