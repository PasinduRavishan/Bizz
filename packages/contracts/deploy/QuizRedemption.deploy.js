// Deployment-ready QuizRedemption contract (no imports, Contract is available in Bitcoin Computer context)
// Auto-generated from TypeScript source - DO NOT EDIT MANUALLY
// Edit the TypeScript file in src/QuizRedemption.ts instead

export class QuizRedemption extends Contract {
    static redeem(quizToken, quizAttempt) {
        quizToken.burn();
        quizAttempt.markAsRedeemed();
        return [quizToken, quizAttempt];
    }
}
export class QuizRedemptionHelper {
    constructor(computer, mod) {
        this.computer = computer;
        this.mod = mod;
    }
    async deploy() {
        this.mod = await this.computer.deploy(`export ${QuizRedemption}`);
        return this.mod;
    }
    validateRedemption(quizToken, quizAttempt) {
        const [student] = quizToken._owners;
        if (!student) {
            throw new Error('Quiz token must be owned by student');
        }
        if (quizToken.amount !== BigInt(1)) {
            throw new Error('Must have exactly 1 quiz token to redeem');
        }
        if (!quizToken.symbol) {
            throw new Error('Invalid quiz token symbol');
        }
        const [attemptOwner] = quizAttempt._owners;
        if (attemptOwner !== student) {
            throw new Error('QuizAttempt must be owned by quiz token owner');
        }
        const quizId = quizToken.originalQuizId || quizToken._id;
        if (quizAttempt.quizRef !== quizId) {
            throw new Error('QuizAttempt must be for the same quiz as the token');
        }
        if (quizAttempt.status !== 'owned') {
            throw new Error('QuizAttempt must be in owned status');
        }
        if (quizAttempt.quizTeacher !== quizToken.teacher) {
            throw new Error('QuizAttempt teacher must match quiz token teacher');
        }
    }
    async redeemQuizToken(quizToken, quizAttempt) {
        this.validateRedemption(quizToken, quizAttempt);
        const { tx, effect } = await this.computer.encode({
            exp: `${QuizRedemption} QuizRedemption.redeem(quizToken, quizAttempt)`,
            env: {
                quizToken: quizToken._rev,
                quizAttempt: quizAttempt._rev
            },
            mod: this.mod
        });
        return { tx, effect };
    }
}
