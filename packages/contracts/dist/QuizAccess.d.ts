import { Contract } from '@bitcoin-computer/lib';
interface Quiz extends Contract {
    _owners: string[];
    _satoshis: bigint;
    amount: bigint;
    symbol: string;
    teacher: string;
    entryFee: bigint;
    mint(to: string, amount: bigint): Quiz;
    transfer(recipient: string, amount: bigint): Quiz;
}
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
export declare class QuizAccess extends Contract {
    static exec(quizToken: Quiz, entryFeePayment: Payment): [Payment, Quiz];
}
export declare class QuizAccessHelper {
    computer: any;
    mod?: string;
    constructor(computer: any, mod?: string);
    deploy(): Promise<string | undefined>;
    validateQuizAccess(quiz: any, payment: any): void;
    createQuizAccessTx(quiz: any, paymentMock: any, sighashType: number): any;
}
export {};
//# sourceMappingURL=QuizAccess.d.ts.map