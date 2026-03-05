import { Contract } from '@bitcoin-computer/lib';
interface Payment extends Contract {
    _owners: string[];
    _satoshis: bigint;
    recipient: string;
    amount: bigint;
    purpose: string;
    reference: string;
    status: string;
    transfer(to: string): void;
}
interface AnswerProof extends Contract {
    _owners: string[];
    student: string;
    quizRef: string;
    attemptRef: string;
    answers: string[];
    score: number;
    passed: boolean;
    transfer(to: string): void;
}
interface QuizAttempt extends Contract {
    _id: string;
    _owners: string[];
    student: string;
    quizTeacher: string;
    status: string;
    passed: boolean | null;
    claimedAt: number | null;
    claimPrize(): void;
}
export declare class PrizeSwap extends Contract {
    static swap(prizePayment: Payment, answerProof: AnswerProof, attempt: QuizAttempt): [Payment, AnswerProof, QuizAttempt];
}
/**
 * Deploy PrizeSwap module
 */
export declare function deployPrizeSwapModule(computer: any, PrizeSwap: any): Promise<string>;
export declare class PrizeSwapHelper {
    computer: any;
    mod?: string;
    constructor(computer: any, mod?: string);
    deploy(): Promise<string | undefined>;
    validateSwap(prizePayment: any, answerProof: any, attempt: any): void;
    createPrizeSwapTx(prizePayment: any, answerProof: any, attempt: any, sighashType: number): any;
}
export {};
//# sourceMappingURL=PrizeSwap.d.ts.map