/**
 * Answer Submission Service
 * Business logic for student answer submission
 */
import { prisma } from '@bizz/database';
import { QuizAttemptHelper } from '@bizz/sdk';
import { QuizCrypto } from '../utils/quiz-crypto';
export class AnswerSubmissionService {
    /**
     * Step 4: Student submits answers
     * Creates commitment and submits to attempt contract
     */
    static async submitAnswers(studentComputer, params) {
        try {
            const { studentId, attemptId, answers } = params;
            // Get attempt
            const attempt = await prisma.quizAttempt.findUnique({
                where: { contractId: attemptId },
                include: { quiz: true }
            });
            if (!attempt) {
                return { success: false, error: 'Attempt not found' };
            }
            if (attempt.status !== 'OWNED') {
                return { success: false, error: 'Attempt not in correct state' };
            }
            // Validate answer count
            if (answers.length !== attempt.quiz.questionCount) {
                return {
                    success: false,
                    error: `Expected ${attempt.quiz.questionCount} answers, got ${answers.length}`
                };
            }
            // Generate commitment
            const nonce = QuizCrypto.generateSalt();
            const commitment = QuizCrypto.hashCommitment(answers, nonce);
            // Sync latest attempt state
            const [latestAttemptRev] = await studentComputer.query({ ids: [attemptId] });
            const syncedAttempt = await studentComputer.sync(latestAttemptRev);
            // Submit commitment
            const attemptHelper = new QuizAttemptHelper(studentComputer);
            const { tx } = await attemptHelper.submitCommitment(syncedAttempt, commitment);
            const txId = await studentComputer.broadcast(tx);
            // Update database
            await prisma.quizAttempt.update({
                where: { id: attempt.id },
                data: {
                    answers: JSON.stringify(answers),
                    nonce,
                    answerCommitment: commitment,
                    status: 'COMMITTED'
                }
            });
            return {
                success: true,
                attemptId,
                commitment,
                txId
            };
        }
        catch (error) {
            console.error('Error in submitAnswers service:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to submit answers'
            };
        }
    }
}
//# sourceMappingURL=answer-submission.service.js.map