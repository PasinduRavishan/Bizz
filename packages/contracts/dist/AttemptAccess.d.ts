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
    /**
     * Atomic exec: Student pays entry fee to access quiz attempt
     *
     * Flow:
     * 1. Teacher creates empty QuizAttempt (owned by teacher)
     * 2. Teacher creates partially signed transaction with mocked entry fee Payment
     * 3. Student creates real entry fee Payment
     * 4. Student completes transaction → atomic swap
     *
     * @param attempt - Empty QuizAttempt owned by teacher
     * @param entryFeePayment - Payment from student (entry fee amount)
     * @returns [entryFeePayment, attempt] with updated ownership
     */
    static exec(attempt: QuizAttempt, entryFeePayment: Payment): [Payment, QuizAttempt];
}
export {};
//# sourceMappingURL=AttemptAccess.d.ts.map