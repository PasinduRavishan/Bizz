import { Contract } from '@bitcoin-computer/lib';
interface SeatToken extends Contract {
    _owners: string[];
    _satoshis: bigint;
    amount: bigint;
    symbol: string;
    quizRef: string;
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
export declare class SeatRedemption extends Contract {
    static redeem(seatToken: SeatToken, quizAttempt: QuizAttempt): [SeatToken, QuizAttempt];
}
export {};
//# sourceMappingURL=SeatRedemption.d.ts.map