// @ts-expect-error - Bitcoin Computer library type definitions issue
import { Contract } from '@bitcoin-computer/lib';
export class QuizAccess extends Contract {
    // DEPRECATED: took quiz template as input and minted inside exec.
    // Caused the quiz template UTXO to change on every student payment,
    // making stored partial txs stale for concurrent students.
    //
    // static exec(quizToken: Quiz, entryFeePayment: Payment): [Payment, Quiz] {
    //   const [teacher] = quizToken._owners
    //   const [student] = entryFeePayment._owners
    //   entryFeePayment.transfer(teacher)
    //   const studentQuiz = quizToken.mint(student, 1n)
    //   return [entryFeePayment, studentQuiz]
    // }
    static exec(mintedToken, entryFeePayment) {
        const [teacher] = mintedToken._owners;
        const [student] = entryFeePayment._owners;
        entryFeePayment.transfer(teacher);
        mintedToken.transferTo(student);
        return [entryFeePayment, mintedToken];
    }
}
// ============================================================================
// HELPER CLASS
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
    createQuizAccessTx(mintedToken, paymentMock, sighashType) {
        const [teacher] = mintedToken._owners;
        if (paymentMock.recipient !== teacher) {
            throw new Error('Entry fee must be paid to teacher');
        }
        return this.computer.encode({
            exp: `${QuizAccess} QuizAccess.exec(mintedToken, entryFeePayment)`,
            env: {
                mintedToken: mintedToken._rev,
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