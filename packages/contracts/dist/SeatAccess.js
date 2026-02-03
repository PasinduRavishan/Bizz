// TypeScript version for local development (not used for deployment)
// Bitcoin Computer requires JavaScript without imports
// For deployment, use the JS version or strip types
// @ts-expect-error - Bitcoin Computer library type definitions issue
import { Contract } from '@bitcoin-computer/lib';
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
export class SeatAccess extends Contract {
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
    static exec(seatToken, entryFeePayment) {
        const [teacher] = seatToken._owners;
        const [student] = entryFeePayment._owners;
        // Validation: Check seat token has available balance
        if (seatToken.amount < 1n) {
            throw new Error('No available seats');
        }
        // Validation: Check payment is addressed to teacher
        if (entryFeePayment.recipient !== teacher) {
            throw new Error('Entry fee must be paid to teacher');
        }
        // Validation: Check payment purpose
        if (entryFeePayment.purpose !== 'Entry Fee') {
            throw new Error('Payment must be for entry fee');
        }
        // Atomic execution (following Sale.exec pattern):
        // 1. Transfer entry fee payment to teacher
        entryFeePayment.transfer(teacher);
        // 2. Split seat token using TBC20 pattern
        // This is the CRITICAL part - seatToken.transfer() returns NEW UTXO
        // and modifies the original seatToken's amount
        const studentSeat = seatToken.transfer(student, 1n);
        // After this:
        // - seatToken.amount is reduced by 1 (teacher keeps remaining)
        // - studentSeat is NEW UTXO with amount=1 owned by student
        // Return payment (now owned by teacher) and new student seat UTXO
        // Order matters for Bitcoin Computer transaction outputs
        return [entryFeePayment, studentSeat];
    }
}
//# sourceMappingURL=SeatAccess.js.map