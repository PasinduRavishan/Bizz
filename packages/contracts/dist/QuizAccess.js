// @ts-expect-error - Bitcoin Computer library type definitions issue
import { Contract } from '@bitcoin-computer/lib';
export class QuizAccess extends Contract {
    static exec(quizToken, entryFeePayment) {
        const [teacher] = quizToken._owners;
        const [student] = entryFeePayment._owners;
        entryFeePayment.transfer(teacher);
        const studentQuiz = quizToken.mint(student, 1n);
        return [entryFeePayment, studentQuiz];
    }
}
// ============================================================================
// HELPER CLASS
// Pattern: Bitcoin Computer monorepo - Helper class with computer instance
// ============================================================================
export class QuizAccessHelper {
    computer;
    mod;
    constructor(computer, mod) {
        this.computer = computer;
        this.mod = mod;
    }
    async deploy() {
        this.mod = await this.computer.deploy(`export ${QuizAccess}`);
        return this.mod;
    }
    // Validation function
    validateQuizAccess(quiz, payment) {
        const [teacher] = quiz._owners;
        // Validation: Check payment is addressed to teacher
        if (payment.recipient !== teacher) {
            throw new Error('Entry fee must be paid to teacher');
        }
        // Validation: Check payment purpose
        if (payment.purpose !== 'Entry Fee') {
            throw new Error('Payment must be for entry fee');
        }
        // Validation: Check payment amount matches quiz entry fee
        if (payment.amount !== quiz.entryFee) {
            throw new Error('Payment amount must match quiz entry fee');
        }
    }
    createQuizAccessTx(quiz, paymentMock, sighashType) {
        // Validate before creating transaction
        this.validateQuizAccess(quiz, paymentMock);
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
//# sourceMappingURL=QuizAccess.js.map