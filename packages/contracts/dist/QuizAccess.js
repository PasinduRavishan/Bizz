// @ts-expect-error - Bitcoin Computer library type definitions issue
import { Contract } from '@bitcoin-computer/lib';
export class QuizAccess extends Contract {
    static exec(quizToken, entryFeePayment) {
        const [teacher] = quizToken._owners;
        const [student] = entryFeePayment._owners;
        // Validation: Check payment is addressed to teacher
        if (entryFeePayment.recipient !== teacher) {
            throw new Error('Entry fee must be paid to teacher');
        }
        // Validation: Check payment purpose
        if (entryFeePayment.purpose !== 'Entry Fee') {
            throw new Error('Payment must be for entry fee');
        }
        // Validation: Check payment amount matches quiz entry fee
        if (entryFeePayment.amount !== quizToken.entryFee) {
            throw new Error('Payment amount must match quiz entry fee');
        }
        // Atomic execution (following TBC20 Sale.exec pattern):
        // 1. Transfer entry fee payment to teacher
        entryFeePayment.transfer(teacher);
        // 2. Mint new quiz token for student (on-demand minting)
        // quizToken.mint() creates a brand new token UTXO for the student
        // Teacher's quiz token is used as template - its balance does NOT decrease
        const studentQuiz = quizToken.mint(student, 1n);
        // Return both modified contracts
        // entryFeePayment: now owned by teacher
        // studentQuiz: freshly minted UTXO with 1 quiz token, owned by student
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
//# sourceMappingURL=QuizAccess.js.map