// Deployment-ready QuizAccess contract (no imports, Contract is available in Bitcoin Computer context)
// Auto-generated from TypeScript source - DO NOT EDIT MANUALLY
// Edit the TypeScript file in src/QuizAccess.ts instead

export class QuizAccess extends Contract {
    static exec(quizToken, entryFeePayment) {
        const [teacher] = quizToken._owners;
        const [student] = entryFeePayment._owners;
        if (entryFeePayment.recipient !== teacher) {
            throw new Error('Entry fee must be paid to teacher');
        }
        if (entryFeePayment.purpose !== 'Entry Fee') {
            throw new Error('Payment must be for entry fee');
        }
        if (entryFeePayment.amount !== quizToken.entryFee) {
            throw new Error('Payment amount must match quiz entry fee');
        }
        entryFeePayment.transfer(teacher);
        const studentQuiz = quizToken.mint(student, 1n);
        return [entryFeePayment, studentQuiz];
    }
}
export class QuizAccessHelper {
    constructor(computer, mod) {
        this.computer = computer;
        this.mod = mod;
    }
    async deploy() {
        this.mod = await this.computer.deploy(`export ${QuizAccess}`);
        return this.mod;
    }
    createQuizAccessTx(quiz, paymentMock, sighashType) {
        return this.computer.encode({
            exp: `${QuizAccess} QuizAccess.exec(quizToken, entryFeePayment)`,
            env: {
                quizToken: quiz._rev,
                entryFeePayment: paymentMock._rev
            },
            mocks: { entryFeePayment: paymentMock },
            mod: this.mod,
            sighashType,
            inputIndex: 0,
            fund: false,
            sign: true
        });
    }
}
