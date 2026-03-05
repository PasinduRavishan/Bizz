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
export declare class QuizRedemption extends Contract {
    static redeem(quizToken: Quiz, quizAttempt: QuizAttempt): [Quiz, QuizAttempt];
}
export declare class QuizRedemptionHelper {
    computer: any;
    mod?: string;
    constructor(computer: any, mod?: string);
    deploy(): Promise<string | undefined>;
    validateRedemption(quizToken: any, quizAttempt: any): void;
    redeemQuizToken(quizToken: any, quizAttempt: any): Promise<{
        tx: any;
        effect: any;
    }>;
}
export {};
//# sourceMappingURL=QuizRedemption.d.ts.map