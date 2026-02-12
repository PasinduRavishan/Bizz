/**
 * Quiz Attempt Service
 *
 * Handles student quiz attempts by calling the API route that deploys contracts.
 * The API route runs on the server with proper Node.js environment.
 * Implements the commit-reveal pattern for secure quiz submissions.
 */
export interface SubmitAttemptParams {
    quizId: string;
    quizRev: string;
    answers: string[];
    entryFee: number;
    studentPublicKey?: string;
}
export interface SubmitAttemptResult {
    success: boolean;
    attemptId?: string;
    attemptRev?: string;
    nonce?: string;
    commitment?: string;
    error?: string;
}
export interface RevealAnswersParams {
    attemptId: string;
    answers?: string[];
    nonce?: string;
}
export interface RevealAnswersResult {
    success: boolean;
    attemptId?: string;
    contractRev?: string;
    txId?: string;
    status?: string;
    revealTimestamp?: string;
    error?: string;
}
export interface RevealStatusResult {
    success: boolean;
    data?: {
        attemptId: string;
        contractId: string;
        status: string;
        quizTitle: string | null;
        quizDeadline: string;
        canReveal: boolean;
        isRevealed: boolean;
        revealedAnswers: string[] | null;
        revealTimestamp: string | null;
        reason: string | null;
    };
    error?: string;
}
/**
 * Submit a quiz attempt by calling the server API
 *
 * This function:
 * 1. Calls POST /api/attempts/submit
 * 2. Server handles contract deployment
 * 3. Returns attempt ID and nonce for reveal phase
 *
 * @param params - Attempt submission parameters
 * @returns Result with attempt ID and nonce
 */
export declare function submitAttempt(params: SubmitAttemptParams): Promise<SubmitAttemptResult>;
/**
 * Get attempt data from API (production approach)
 *
 * @param attemptId - Attempt contract ID
 * @returns Attempt data from database
 */
export declare function getAttemptData(attemptId: string): Promise<any>;
/**
 * Reveal answers for an attempt (Phase 2 of commit-reveal)
 *
 * This should be called after the quiz deadline but before reveal deadline.
 * Calls the server API which handles blockchain interaction.
 *
 * @param params - Reveal parameters
 * @returns Result with reveal confirmation
 */
export declare function revealAnswers(params: RevealAnswersParams): Promise<RevealAnswersResult>;
/**
 * Get reveal status for an attempt
 *
 * @param attemptId - Attempt ID (database or contract ID)
 * @returns Reveal status information
 */
export declare function getRevealStatus(attemptId: string): Promise<RevealStatusResult>;
/**
 * Get quiz attempts from API (production approach)
 *
 * @param quizId - Quiz contract ID
 * @returns Array of attempt IDs from database
 */
export declare function getQuizAttempts(quizId: string): Promise<string[]>;
//# sourceMappingURL=attempt-service.d.ts.map