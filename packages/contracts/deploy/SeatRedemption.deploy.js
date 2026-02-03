// Deployment-ready SeatRedemption contract (no imports, Contract is available in Bitcoin Computer context)
// Auto-generated from TypeScript source - DO NOT EDIT MANUALLY
// Edit the TypeScript file in src/SeatRedemption.ts instead

export class SeatRedemption extends Contract {
    static redeem(seatToken, quizAttempt) {
        const [student] = seatToken._owners;
        if (!student) {
            throw new Error('Seat token must be owned by student');
        }
        if (seatToken.amount !== 1n) {
            throw new Error('Must have exactly 1 seat token to redeem');
        }
        if (seatToken.symbol !== 'SEAT') {
            throw new Error('Invalid seat token symbol');
        }
        const [attemptOwner] = quizAttempt._owners;
        if (attemptOwner !== student) {
            throw new Error('QuizAttempt must be owned by seat token owner');
        }
        if (quizAttempt.quizRef !== seatToken.quizRef) {
            throw new Error('QuizAttempt must be for the same quiz as the seat');
        }
        if (quizAttempt.status !== 'owned') {
            throw new Error('QuizAttempt must be in owned status');
        }
        seatToken.burn();
        quizAttempt.markAsRedeemed();
        return [seatToken, quizAttempt];
    }
}
