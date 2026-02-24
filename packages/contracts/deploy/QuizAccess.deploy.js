// Deployment-ready QuizAccess contract (no imports, Contract is available in Bitcoin Computer context)
// Auto-generated from TypeScript source - DO NOT EDIT MANUALLY
// Edit the TypeScript file in src/QuizAccess.ts instead

export class QuizAccess extends Contract {
    static exec(mintedToken, entryFeePayment) {
        const [teacher] = mintedToken._owners;
        const [student] = entryFeePayment._owners;
        entryFeePayment.transfer(teacher);
        mintedToken.transferTo(student);
        return [entryFeePayment, mintedToken];
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
