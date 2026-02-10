// Deployment-ready AnswerProof contract (no imports, Contract is available in Bitcoin Computer context)
// Auto-generated from TypeScript source - DO NOT EDIT MANUALLY
// Edit the TypeScript file in src/AnswerProof.ts instead

export class AnswerProof extends Contract {
    constructor(student, quizRef, attemptRef, answers, score, passed) {
        if (!student)
            throw new Error('Student public key required');
        if (!quizRef)
            throw new Error('Quiz reference required');
        if (!attemptRef)
            throw new Error('Attempt reference required');
        if (!Array.isArray(answers) || answers.length === 0) {
            throw new Error('Answers must be a non-empty array');
        }
        if (score < 0 || score > 100) {
            throw new Error('Score must be between 0 and 100');
        }
        super({
            _owners: [student],
            _satoshis: BigInt(546), // Dust amount
            student,
            quizRef,
            attemptRef,
            answers,
            score,
            passed,
            createdAt: Date.now()
        });
    }
    transfer(to) {
        this._owners = [to];
    }
    getInfo() {
        return {
            proofId: this._id,
            student: this.student,
            quizRef: this.quizRef,
            attemptRef: this.attemptRef,
            answers: this.answers,
            score: this.score,
            passed: this.passed,
            createdAt: this.createdAt
        };
    }
}
export class AnswerProofHelper {
    constructor(computer, mod) {
        this.computer = computer;
        this.mod = mod;
    }
    async deploy() {
        this.mod = await this.computer.deploy(`export ${AnswerProof}`);
        return this.mod;
    }
    async createAnswerProof(params) {
        const { tx, effect } = await this.computer.encode({
            mod: this.mod,
            exp: `new AnswerProof("${params.student}", "${params.quizRef}", "${params.attemptRef}", ${JSON.stringify(params.answers)}, ${params.score}, ${params.passed})`
        });
        return { tx, effect };
    }
}
