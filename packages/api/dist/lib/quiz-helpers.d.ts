import { Computer } from '@bitcoin-computer/lib';
/**
 * Query all attempts for a specific quiz
 *
 * @param computer - Bitcoin Computer instance
 * @param quizRev - Quiz revision to query attempts for
 * @returns Array of QuizAttempt contracts
 */
export declare function getQuizAttempts(computer: typeof Computer.prototype, quizRev: string): Promise<unknown[]>;
/**
 * Get attempt count for a quiz (off-chain)
 * In production, this queries your database/indexer
 */
export declare function getAttemptCount(quizRev: string): Promise<number>;
/**
 * Verify hash matches commitment
 * This happens off-chain in the app
 */
export declare function verifyCommitment(answers: string[], nonce: string, commitment: string): boolean;
/**
 * Verify answer hash matches
 * This happens off-chain in the app
 */
export declare function verifyAnswerHash(quizId: string, index: number, answer: string, salt: string, expectedHash: string): boolean;
//# sourceMappingURL=quiz-helpers.d.ts.map