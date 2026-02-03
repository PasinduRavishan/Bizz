import { Contract } from '@bitcoin-computer/lib';
interface Quiz extends Contract {
    _owners: string[];
    _satoshis: bigint;
    amount: bigint;
    symbol: string;
    teacher: string;
    entryFee: bigint;
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
/**
 * QuizAccess - Atomic Quiz Purchase (EXEC Pattern)
 *
 * Enables atomic swap:
 * - Teacher gives Quiz fungible token (1 quiz token)
 * - Student pays entry fee (Payment contract)
 *
 * Uses SIGHASH_SINGLE | SIGHASH_ANYONECANPAY for partial signing:
 * 1. Teacher creates Quiz token and mock Payment
 * 2. Teacher partially signs with their input (quiz token)
 * 3. Student creates real Payment
 * 4. Student updates transaction with real payment UTXO
 * 5. Student funds, signs, and broadcasts
 * 6. Atomic execution: both transfers happen or neither happens
 *
 * Result:
 * - Student receives 1 Quiz token
 * - Teacher receives entry fee Payment
 */
export declare class QuizAccess extends Contract {
    /**
     * Execute atomic quiz purchase
     *
     * @param quizToken - Teacher's Quiz fungible token
     * @param entryFeePayment - Student's entry fee Payment
     * @returns [Payment to teacher, Quiz token to student]
     */
    static exec(quizToken: Quiz, entryFeePayment: Payment): [Payment, Quiz];
}
export {};
//# sourceMappingURL=QuizAccess.d.ts.map