// Deployment-ready SeatAccess contract (no imports, Contract is available in Bitcoin Computer context)
// Auto-generated from TypeScript source - DO NOT EDIT MANUALLY
// Edit the TypeScript file in src/SeatAccess.ts instead

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
        if (seatToken.amount < 1n) {
            throw new Error('No available seats');
        }
        if (entryFeePayment.recipient !== teacher) {
            throw new Error('Entry fee must be paid to teacher');
        }
        if (entryFeePayment.purpose !== 'Entry Fee') {
            throw new Error('Payment must be for entry fee');
        }
        entryFeePayment.transfer(teacher);
        const studentSeat = seatToken.transfer(student, 1n);
        return [entryFeePayment, studentSeat];
    }
}
