// TypeScript version for local development (not used for deployment)
// Bitcoin Computer requires JavaScript without imports
// For deployment, use the JS version or strip types
// @ts-expect-error - Bitcoin Computer library type definitions issue
import { Contract } from '@bitcoin-computer/lib';
export class QuizAttempt extends Contract {
    // Contract base properties
    _id;
    _rev;
    _owners;
    _satoshis;
    // QuizAttempt properties
    student;
    quizRef;
    answerCommitment;
    quizTeacher;
    revealedAnswers;
    nonce;
    score;
    passed;
    status;
    submitTimestamp;
    revealTimestamp;
    claimedAt;
    version;
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
        // Allow verification from either 'committed' (auto-grading) or 'revealed' (manual reveal)
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
        // Step 1: Student transfers ownership to teacher
        // MUST be called by STUDENT (current owner) to authorize the ownership transfer
        if (quiz.status !== 'completed') {
            throw new Error('Cannot transfer ownership: quiz not completed');
        }
        if (this.status === 'ownership-transferred' || this.status === 'forfeited') {
            throw new Error('Ownership already transferred');
        }
        // Transfer ownership to teacher (creates new UTXO with teacher as owner)
        this._owners = [this.quizTeacher];
        this.status = 'ownership-transferred';
    }
    claimEntryFee() {
        // Step 2: Teacher claims the entry fee
        // MUST be called by TEACHER (new owner) after ownership transfer
        if (this.status !== 'ownership-transferred') {
            throw new Error('Ownership must be transferred first');
        }
        // Reduce to dust - funds go to caller (teacher)
        this._satoshis = BigInt(546);
        this.status = 'forfeited';
    }
    // Mark attempt as fee collected
    // Entry fee is stored as metadata (like Quiz.prizePool), not locked in UTXO
    // Payment contracts must be created separately by the teacher
    collectFee() {
        // Can collect from committed, verified, or failed status
        if (!['committed', 'verified', 'failed'].includes(this.status)) {
            throw new Error('Cannot collect fee from this status');
        }
        if (this.status === 'fee_collected') {
            throw new Error('Fee already collected');
        }
        // Mark as collected (satoshis already at dust level)
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
        // Student can claim refund if:
        // 1. Quiz is abandoned (teacher never revealed or never distributed)
        // 2. They haven't claimed refund yet
        // 3. Caller is the student who owns this attempt
        if (quiz.status !== 'abandoned') {
            throw new Error('Cannot claim refund: quiz not abandoned');
        }
        if (this.status === 'refunded') {
            throw new Error('Refund already claimed');
        }
        if (!this._owners.includes(this.student)) {
            throw new Error('Only the student can claim refund');
        }
        // Mark as refunded and reduce to dust
        // The actual refund amount is withdrawn by the student wallet
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
//# sourceMappingURL=QuizAttempt.js.map