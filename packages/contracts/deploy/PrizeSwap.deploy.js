// Deployment-ready PrizeSwap contract (no imports, Contract is available in Bitcoin Computer context)
// Auto-generated from TypeScript source - DO NOT EDIT MANUALLY
// Edit the TypeScript file in src/PrizeSwap.ts instead

export class PrizeSwap extends Contract {
    static swap(prizePayment, answerProof, attempt) {
        const [student] = attempt._owners;
        const teacher = attempt.quizTeacher;
        prizePayment.transfer(student); // Student receives prize
        answerProof.transfer(teacher); // Teacher receives answer proof
        attempt.claimPrize();
        return [prizePayment, answerProof, attempt];
    }
}
export async function deployPrizeSwapModule(computer, PrizeSwap) {
    return await computer.deploy(`export ${PrizeSwap}`);
}
export class PrizeSwapHelper {
    constructor(computer, mod) {
        this.computer = computer;
        this.mod = mod;
    }
    async deploy() {
        this.mod = await this.computer.deploy(`export ${PrizeSwap}`);
        return this.mod;
    }
    validateSwap(prizePayment, answerProof, attempt) {
        const [student] = attempt._owners;
        const [proofOwner] = answerProof._owners;
        if (student !== prizePayment.recipient) {
            throw new Error('Prize payment must be addressed to attempt owner');
        }
        if (proofOwner !== student) {
            throw new Error('Answer proof must be owned by student');
        }
        if (answerProof.attemptRef !== attempt._id) {
            throw new Error('Answer proof must match the attempt');
        }
        if (attempt.status !== 'verified') {
            throw new Error('Attempt must be verified before claiming prize');
        }
        if (!attempt.passed) {
            throw new Error('Only passing attempts can claim prizes');
        }
        if (!answerProof.passed) {
            throw new Error('Answer proof must show student passed');
        }
    }
    createPrizeSwapTx(prizePayment, answerProof, attempt, sighashType) {
        this.validateSwap(prizePayment, answerProof, attempt);
        return this.computer.encode({
            exp: `${PrizeSwap} PrizeSwap.swap(prizePayment, answerProof, attempt)`,
            env: {
                prizePayment: prizePayment._rev,
                answerProof: answerProof._rev,
                attempt: attempt._rev
            },
            mod: this.mod,
            fund: false,
            sign: true,
            sighashType
        });
    }
}
