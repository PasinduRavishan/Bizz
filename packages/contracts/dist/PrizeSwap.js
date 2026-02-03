// TypeScript version for local development (not used for deployment)
// Bitcoin Computer requires JavaScript without imports
// For deployment, use the JS version or strip types
// @ts-expect-error - Bitcoin Computer library type definitions issue
import { Contract } from '@bitcoin-computer/lib';
export class PrizeSwap extends Contract {
    static swap(prizePayment, answerProof, attempt) {
        // Get current owners
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
//# sourceMappingURL=PrizeSwap.js.map