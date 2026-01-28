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
    revealedAnswers: string[] | null;
    nonce: string | null;
    score: number | null;
    passed: boolean | null;
    status: string;
    submitTimestamp: number;
    revealTimestamp: number | null;
    claimedAt: number | null;
    version: string;
    constructor(student: string, quizRef: string, answerCommitment: string, entryFee: bigint, quizTeacher: string);
    reveal(answers: string[], nonce: string): void;
    verify(score: number, passed: boolean): void;
    fail(): void;
    transferOwnershipToTeacher(quiz: {
        status: string;
    }): void;
    claimEntryFee(): void;
    collectFee(): void;
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
        revealTimestamp: number | null;
        score: number | null;
        passed: boolean | null;
        hasRevealed: boolean;
        revealedAnswers: string[] | null;
    };
}
//# sourceMappingURL=QuizAttempt.d.ts.map