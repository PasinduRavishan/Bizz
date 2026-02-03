import { Contract } from '@bitcoin-computer/lib';
interface Payment extends Contract {
    _owners: string[];
    _satoshis: bigint;
    recipient: string;
    transfer(to: string): void;
}
interface QuizAttempt extends Contract {
    _owners: string[];
    answerCommitment: string;
    entryFee: bigint;
    quizTeacher: string;
    status: string;
    transfer(newOwner: string): void;
}
export declare class AttemptAccess extends Contract {
    static exec(attempt: QuizAttempt, entryFeePayment: Payment): [Payment, QuizAttempt];
}
export {};
//# sourceMappingURL=AttemptAccess.d.ts.map