import { Contract } from '@bitcoin-computer/lib';
export declare class QuizAttempt extends Contract {
    _id: string;
    _rev: string;
    _owners: string[];
    _satoshis: bigint;
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
    constructor(owner: string, // Student who owns this attempt
    quizRef: string, answerCommitment: string, // Empty at creation, filled after redemption
    entryFee: bigint, quizTeacher: string);
    markAsRedeemed(): void;
    transfer(newOwner: string): void;
    submitCommitment(commitment: string): void;
    verify(score: number, passed: boolean): void;
    fail(): void;
    claimPrize(): void;
    claimRefund(quiz: {
        status: string;
    }): void;
    getInfo(): {
        attemptId: string;
        student: string;
        quizRef: string;
        status: string;
        submitTimestamp: number;
        score: number | null;
        passed: boolean | null;
        answerCommitment: string;
    };
}
//# sourceMappingURL=QuizAttempt.d.ts.map