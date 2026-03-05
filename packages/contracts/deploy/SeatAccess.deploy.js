// Deployment-ready SeatAccess contract (no imports, Contract is available in Bitcoin Computer context)
// Auto-generated from TypeScript source - DO NOT EDIT MANUALLY
// Edit the TypeScript file in src/SeatAccess.ts instead

export class SeatAccess extends Contract {
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
