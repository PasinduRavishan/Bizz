import { Contract } from '@bitcoin-computer/lib';
interface SeatToken extends Contract {
    _owners: string[];
    _satoshis: bigint;
    amount: bigint;
    symbol: string;
    quizRef: string;
    transfer(recipient: string, amount: bigint): SeatToken;
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
 * SeatAccess - Exec pattern for atomic seat token purchase
 *
 * Enables students to atomically purchase seat tokens by paying entry fee.
 * Uses partial signing (SIGHASH_SINGLE | SIGHASH_ANYONECANPAY) pattern.
 *
 * Flow:
 * 1. Teacher creates partial transaction with mock Payment
 * 2. Teacher signs their input (seatToken)
 * 3. Student creates real Payment (entry fee)
 * 4. Student replaces mock with real payment
 * 5. Student signs and broadcasts
 *
 * Result: Atomic swap - student gets seat token, teacher gets entry fee
 */
export declare class SeatAccess extends Contract {
    /**
     * Execute atomic seat purchase (TBC20 + Exec Pattern)
     *
     * This follows the Sale.exec pattern from Bitcoin Computer docs
     * with TBC20 fungible token split.
     *
     * @param seatToken - SeatToken UTXO owned by teacher
     * @param entryFeePayment - Payment UTXO owned by student (entry fee)
     * @returns Tuple of [payment transferred to teacher, new studentSeat UTXO]
     */
    static exec(seatToken: SeatToken, entryFeePayment: Payment): [Payment, SeatToken];
}
export {};
//# sourceMappingURL=SeatAccess.d.ts.map