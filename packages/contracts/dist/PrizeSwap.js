// TypeScript version for local development (not used for deployment)
// Bitcoin Computer requires JavaScript without imports
// For deployment, use the JS version or strip types
// @ts-expect-error - Bitcoin Computer library type definitions issue
import { Contract } from '@bitcoin-computer/lib';
export class PrizeSwap extends Contract {
    static swap(prizePayment, answerProof, attempt) {
        // Get current owners
        const [student] = attempt._owners;
        // Get teacher from attempt
        const teacher = attempt.quizTeacher;
        // Atomic swap: Exchange ownership using transfer() methods
        prizePayment.transfer(student); // Student receives prize
        answerProof.transfer(teacher); // Teacher receives answer proof
        // Mark attempt as claimed using its method
        attempt.claimPrize();
        // Return all three objects with updated state
        return [prizePayment, answerProof, attempt];
    }
}
// ============================================================================
// HELPER FUNCTIONS
// Pattern: Bitcoin Computer monorepo - helpers outside class in same file
// ============================================================================
/**
 * Deploy PrizeSwap module
 */
export async function deployPrizeSwapModule(computer, PrizeSwap) {
    return await computer.deploy(`export ${PrizeSwap}`);
}
// ============================================================================
// HELPER CLASS
// Pattern: Bitcoin Computer monorepo - Helper class with computer instance
// ============================================================================
export class PrizeSwapHelper {
    computer;
    mod;
    constructor(computer, mod) {
        this.computer = computer;
        this.mod = mod;
    }
    async deploy() {
        this.mod = await this.computer.deploy(`export ${PrizeSwap}`);
        return this.mod;
    }
    // Validation function
    validateSwap(prizePayment, answerProof, attempt) {
        const [student] = attempt._owners;
        const [proofOwner] = answerProof._owners;
        // Verification 1: Prize payment recipient matches attempt owner
        if (student !== prizePayment.recipient) {
            throw new Error('Prize payment must be addressed to attempt owner');
        }
        // Verification 2: Answer proof is owned by the student
        if (proofOwner !== student) {
            throw new Error('Answer proof must be owned by student');
        }
        // Verification 3: Answer proof matches the attempt
        if (answerProof.attemptRef !== attempt._id) {
            throw new Error('Answer proof must match the attempt');
        }
        // Verification 4: Attempt is in verified status (graded)
        if (attempt.status !== 'verified') {
            throw new Error('Attempt must be verified before claiming prize');
        }
        // Verification 5: Student passed the quiz
        if (!attempt.passed) {
            throw new Error('Only passing attempts can claim prizes');
        }
        // Verification 6: Answer proof shows student passed
        if (!answerProof.passed) {
            throw new Error('Answer proof must show student passed');
        }
    }
    createPrizeSwapTx(prizePayment, answerProof, attempt, sighashType) {
        // Validate before creating swap transaction
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
//# sourceMappingURL=PrizeSwap.js.map