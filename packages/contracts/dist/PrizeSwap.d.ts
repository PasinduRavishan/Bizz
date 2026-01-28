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
interface QuizAttempt extends Contract {
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
     * Atomic swap: Student pays entry fee and receives prize payment
     *
     * @param prizePayment - Payment contract from teacher (prize amount)
     * @param entryFeePayment - Payment contract from student (entry fee)
     * @param attempt - QuizAttempt contract
     * @returns [prizePayment, entryFeePayment, attempt] with updated ownership
     */
    static swap(prizePayment: Payment, entryFeePayment: Payment, attempt: QuizAttempt): [Payment, Payment, QuizAttempt];
}
export {};
//# sourceMappingURL=PrizeSwap.d.ts.map