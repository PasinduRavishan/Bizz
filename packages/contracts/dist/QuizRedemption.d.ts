import { Contract } from '@bitcoin-computer/lib';
interface Quiz extends Contract {
    _id: string;
    _owners: string[];
    _satoshis: bigint;
    amount: bigint;
    symbol: string;
    teacher: string;
    originalQuizId: string;
    burn(): void;
}
interface QuizAttempt extends Contract {
    _id: string;
    _owners: string[];
    student: string;
    quizRef: string;
    answerCommitment: string;
    quizTeacher: string;
    entryFee: bigint;
    score: number | null;
    passed: boolean | null;
    status: string;
    submitTimestamp: number;
    claimedAt: number | null;
    version: string;
    isRedeemed: boolean;
    markAsRedeemed(): void;
}
/**
 * QuizRedemption - Convert Quiz Token → QuizAttempt
 *
 * Student redeems their Quiz fungible token to create/unlock a QuizAttempt.
 * This enforces that students MUST own a quiz token before submitting answers.
 *
 * Process:
 * 1. Student owns 1 Quiz token (received via QuizAccess.exec)
 * 2. Student creates QuizAttempt (owned status)
 * 3. Student calls QuizRedemption.redeem(quizToken, quizAttempt)
 * 4. Quiz token gets burned (amount set to 0)
 * 5. QuizAttempt marked as redeemed (isRedeemed = true)
 * 6. Student can now submit answers
 *
 * Security:
 * - Prevents students from creating multiple attempts with one quiz token
 * - Ensures quiz token ownership before allowing quiz attempts
 * - Burns quiz token to prevent reuse
 */
export declare class QuizRedemption extends Contract {
    /**
     * Redeem quiz token to unlock quiz attempt
     *
     * @param quizToken - Student's Quiz fungible token (must own 1)
     * @param quizAttempt - Student's QuizAttempt (must be owned status)
     * @returns [Burned quiz token, Redeemed quiz attempt]
     */
    static redeem(quizToken: Quiz, quizAttempt: QuizAttempt): [Quiz, QuizAttempt];
}
export {};
//# sourceMappingURL=QuizRedemption.d.ts.map