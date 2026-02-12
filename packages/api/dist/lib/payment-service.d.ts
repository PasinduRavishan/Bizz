/**
 * Payment Service - Bitcoin Computer Implementation
 *
 * Properly implements prize distribution and fee collection using
 * Bitcoin Computer's contract-based payment pattern.
 *
 * FLOW:
 * 1. Prize Distribution: Quiz.distributePrizes() creates Payment contracts
 * 2. Fee Collection: QuizAttempt.collectFee() creates Payment contracts
 * 3. Claiming: Recipients call Payment.claim() to get funds
 */
/**
 * Distribute prizes to winners
 *
 * NOTE: This works with existing contracts by tracking ownership in database.
 * Prizes are already locked in Quiz contract from teacher's payment at creation.
 *
 * @param quizId - Quiz ID
 * @returns Distribution results
 */
export declare function distributePrizes(quizId: string): Promise<{
    totalAmount: string;
    distributed: number;
    failed: number;
    payments: Array<{
        winnerId: string;
        userId: string;
        amount: string;
        status: string;
    }>;
}>;
/**
 * Calculate entry fee distribution
 *
 * NOTE: Entry fees are already locked in QuizAttempt contracts.
 * This function calculates how they should be distributed.
 *
 * @param quizId - Quiz ID
 * @returns Fee calculation
 */
export declare function collectEntryFees(quizId: string): Promise<{
    attemptCount: number;
    totalEntryFees: string;
    platformFeeAmount: string;
    teacherAmount: string;
    collected: number;
    failed: number;
    payments: any[];
}>;
/**
 * Refresh wallet balances for all users involved in a quiz
 *
 * @param quizId - Quiz ID
 */
export declare function refreshQuizBalances(quizId: string): Promise<void>;
/**
 * Complete payment processing after teacher reveals
 *
 * IMPORTANT: This version works with existing contracts by using database tracking.
 * For new quizzes created with updated contract code, the full Payment contract
 * system will be used automatically.
 *
 * @param quizId - Quiz ID
 * @returns Complete results
 */
export declare function processQuizPayments(quizId: string): Promise<{
    prizes: {
        totalAmount: string;
        distributed: number;
        failed: number;
        payments: Array<{
            winnerId: string;
            userId: string;
            amount: string;
            status: string;
        }>;
    };
    fees: {
        attemptCount: number;
        totalEntryFees: string;
        platformFeeAmount: string;
        teacherAmount: string;
        collected: number;
        failed: number;
        payments: any[];
    };
}>;
/**
 * Claim a payment (for future use with Payment contracts)
 *
 * @param userId - User claiming the payment
 * @param paymentRev - Payment contract revision
 * @returns Claim result
 */
export declare function claimPayment(userId: string, paymentRev: string): Promise<{
    success: boolean;
    paymentId: any;
    amount: any;
    newBalance: string;
}>;
//# sourceMappingURL=payment-service.d.ts.map