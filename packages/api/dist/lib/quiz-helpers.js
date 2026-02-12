// import QuizAttempt from '../../contracts/QuizAttempt'
import crypto from 'crypto';
/**
 * Query all attempts for a specific quiz
 *
 * @param computer - Bitcoin Computer instance
 * @param quizRev - Quiz revision to query attempts for
 * @returns Array of QuizAttempt contracts
 */
export async function getQuizAttempts(computer, quizRev) {
    // Bitcoin Computer doesn't have built-in query yet
    // For now, we track attempts off-chain in our database
    // Or we can sync all QuizAttempt contracts and filter
    // This will be implemented when we add the indexer
    // For now, return empty array
    console.log('📊 Querying attempts for quiz:', quizRev);
    console.log('📊 Computer instance:', computer);
    return [];
}
/**
 * Get attempt count for a quiz (off-chain)
 * In production, this queries your database/indexer
 */
export async function getAttemptCount(quizRev) {
    // Query from database
    // For now, return 0
    console.log('📊 Getting attempt count for:', quizRev);
    return 0;
}
/**
 * Verify hash matches commitment
 * This happens off-chain in the app
 */
export function verifyCommitment(answers, nonce, commitment) {
    const data = JSON.stringify(answers) + nonce;
    const hash = crypto.createHash('sha256').update(data).digest('hex');
    return hash === commitment;
}
/**
 * Verify answer hash matches
 * This happens off-chain in the app
 */
export function verifyAnswerHash(quizId, index, answer, salt, expectedHash) {
    const data = `${quizId}${index}${answer}${salt}`;
    const hash = crypto.createHash('sha256').update(data).digest('hex');
    return hash === expectedHash;
}
//# sourceMappingURL=quiz-helpers.js.map