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
    /**
     * Atomic swap: Student gives answer proof and receives prize payment
     *
     * NOTE: Entry fees already collected in Phase 1 (AttemptAccess.exec)
     * This swap exchanges prize for answer proof only
     *
     * @param prizePayment - Payment contract from teacher (prize amount)
     * @param answerProof - AnswerProof contract from student (their answers)
     * @param attempt - QuizAttempt contract
     * @returns [prizePayment, answerProof, attempt] with updated ownership
     */
    static swap(prizePayment: Payment, answerProof: AnswerProof, attempt: QuizAttempt): [Payment, AnswerProof, QuizAttempt];
}
export {};
//# sourceMappingURL=PrizeSwap.d.ts.map