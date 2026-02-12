/**
 * Payment Distribution Service (Decentralized Bitcoin Computer Model)
 *
 * This implements proper decentralized Bitcoin Computer payment distribution:
 * - Teachers create Quiz contracts with prize pool LOCKED in contract satoshis
 * - Students submit QuizAttempt contracts with entry fees LOCKED in contract satoshis
 * - Quiz.distributePrizes() creates Payment contracts FROM Quiz's locked satoshis (not teacher wallet)
 * - QuizAttempt.collectFee() creates Payment contracts FROM attempt's locked satoshis
 * - Students/teachers claim Payment contracts to receive funds
 *
 * CRITICAL: Uses computer.encode() + broadcast() pattern for contract method calls.
 * Direct method calls (contract.method()) don't work with Bitcoin Computer v0.26.0-beta.0
 * because nested contract creation requires proper _computer context.
 *
 * Fund Flow:
 * 1. Teacher deposits → Quiz contract (185k sats locked)
 * 2. Students pay entry fees → QuizAttempt contracts (18.5k each locked)
 * 3. Teacher reveals → Quiz.distributePrizes() → Payment contracts (FROM Quiz's 185k)
 * 4. System calls collectFee() → Payment contracts (FROM QuizAttempt satoshis)
 * 5. Recipients claim() → Funds released to their wallets
 *
 * Result: Teacher net = entry fees collected - prizes paid (all from contract funds)
 */
/**
 * NOTE: Payment contracts are now created inside Quiz.distributePrizes() method.
 * The Quiz contract creates Payment contracts using its own locked satoshis,
 * ensuring funds flow correctly from Quiz → Payment → Student wallets.
 *
 * The PaymentContractSource definition is no longer needed here.
 */
/**
 * Distribute prizes to winners by creating Payment contracts
 * Each Payment contract holds the prize amount for a winner to claim
 *
 * @param quizId - Quiz database ID
 * @param revealedQuizRev - UPDATED quiz contract revision after revealAnswers (with status 'revealed')
 */
export declare function distributePrizesToWinners(quizId: string, revealedQuizRev?: string): Promise<{
    distributed: number;
    totalAmount: string;
    payments: any[];
}>;
/**
 * Calculate entry fee distribution
 * Entry fees were paid by students when they attempted the quiz
 * This is for accounting/display purposes - the funds are already in the contracts
 */
export declare function payEntryFeesToTeacher(quizId: string): Promise<{
    collected: number;
    totalTeacherAmount: string;
    totalPlatformFee: string;
    payments: {
        attemptId: string;
        userId: string;
        teacherAmount: string;
        platformFee: string;
        status: "accounted";
    }[];
}>;
/**
 * Complete payment flow
 * 1. Create Payment contracts for winners (actual blockchain contracts)
 * 2. Calculate entry fee distribution (for accounting)
 *
 * @param quizId - Quiz database ID
 * @param revealedQuizRev - UPDATED quiz contract revision after revealAnswers (status 'revealed')
 */
export declare function processCompletePayments(quizId: string, revealedQuizRev?: string): Promise<{
    success: boolean;
    prizes: {
        distributed: number;
        totalAmount: string;
        payments: any[];
    };
    fees: {
        collected: number;
        totalTeacherAmount: string;
        totalPlatformFee: string;
        payments: {
            attemptId: string;
            userId: string;
            teacherAmount: string;
            platformFee: string;
            status: "accounted";
        }[];
    };
    netTeacherChange: string;
    platformFee: string;
}>;
/**
 * Claim a Payment contract
 *
 * Winners can claim their Payment contracts to release funds to their wallets.
 * This reduces the Payment contract to dust (546 sats) and releases the funds.
 *
 * @param userId - User claiming the payment
 * @param paymentRev - Payment contract revision
 * @param moduleSpecifier - Quiz module specifier (needed for encodeCall)
 */
export declare function claimPayment(userId: string, paymentRev: string, moduleSpecifier: string): Promise<{
    success: boolean;
    message: string;
    paymentRev: string;
    amount: any;
    newBalance?: undefined;
    txId?: undefined;
} | {
    success: boolean;
    message: string;
    paymentRev: string;
    amount: any;
    newBalance: string;
    txId: string;
}>;
//# sourceMappingURL=payment-distribution.d.ts.map