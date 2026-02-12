/**
 * Quiz Service
 *
 * Handles quiz creation by calling the API route that deploys contracts.
 * The API route runs on the server with proper Node.js environment.
 */
export interface QuizQuestion {
    question: string;
    options: string[];
    correctAnswer: number;
}
export interface CreateQuizParams {
    questions: QuizQuestion[];
    prizePool: number;
    entryFee: number;
    passThreshold: number;
    deadline: Date;
    title?: string;
    description?: string;
    teacherPublicKey?: string;
}
export interface CreateQuizResult {
    success: boolean;
    quizId?: string;
    quizRev?: string;
    error?: string;
    salt?: string;
    correctAnswers?: string[];
}
/**
 * Create a new quiz by calling the server API
 *
 * This function:
 * 1. Calls POST /api/quizzes/create
 * 2. Server handles contract deployment
 * 3. Returns quiz ID and salt for teacher
 *
 * @param params - Quiz creation parameters
 * @returns Result with quiz ID or error
 */
export declare function createQuiz(params: CreateQuizParams): Promise<CreateQuizResult>;
/**
 * Get quiz salt from API (production approach)
 *
 * @param quizId - Quiz contract ID
 * @returns Salt string from database or null
 */
export declare function getQuizSalt(quizId: string): Promise<string | null>;
/**
 * Get quiz answers from API (production approach)
 * Note: This should only be accessible to the quiz creator
 *
 * @param quizId - Quiz contract ID
 * @returns Array of correct answers from database or null
 */
export declare function getQuizAnswers(quizId: string): Promise<string[] | null>;
export interface RevealQuizParams {
    quizId: string;
    answers?: string[];
    salt?: string;
}
export interface RevealQuizResult {
    success: boolean;
    quizId?: string;
    contractRev?: string;
    txId?: string;
    status?: string;
    revealTimestamp?: string;
    scoringResults?: {
        processed: number;
        passed: number;
        failed: number;
    };
    error?: string;
}
export interface QuizRevealStatusResult {
    success: boolean;
    data?: {
        quizId: string;
        contractId: string;
        status: string;
        title: string | null;
        questionCount: number;
        deadline: string;
        teacherRevealDeadline: string;
        canReveal: boolean;
        isRevealed: boolean;
        revealedAnswers: string[] | null;
        reason: string | null;
        attemptStats: {
            total: number;
            committed: number;
            revealed: number;
            verified: number;
            failed: number;
        };
        salt: string | null;
    };
    error?: string;
}
/**
 * Reveal correct answers for a quiz (teacher action)
 *
 * This should be called after student reveal window closes but before
 * teacher reveal deadline.
 *
 * @param params - Reveal parameters with quiz ID, answers, and salt
 * @returns Result with reveal confirmation and scoring results
 */
export declare function revealQuizAnswers(params: RevealQuizParams): Promise<RevealQuizResult>;
/**
 * Get reveal status for a quiz
 *
 * @param quizId - Quiz ID (database or contract ID)
 * @returns Reveal status information including attempt stats
 */
export declare function getQuizRevealStatus(quizId: string): Promise<QuizRevealStatusResult>;
//# sourceMappingURL=quiz-service.d.ts.map