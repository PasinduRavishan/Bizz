/**
 * Student Attempt Service
 * Business logic for student attempt operations
 */
import { prisma } from '@bizz/database';
import { QuizAttemptHelper } from '@bizz/sdk';
export class StudentAttemptService {
    /**
     * Step 2: Student requests an attempt
     * Creates a QuizAttempt contract
     */
    static async requestAttempt(studentComputer, params) {
        try {
            const { studentId, quizId } = params;
            // Get quiz from database
            const quiz = await prisma.quiz.findUnique({
                where: { contractId: quizId }
            });
            if (!quiz) {
                return { success: false, error: 'Quiz not found' };
            }
            if (quiz.status !== 'ACTIVE') {
                return { success: false, error: 'Quiz is not active' };
            }
            const studentPubKey = studentComputer.getPublicKey();
            // Create QuizAttempt using helper
            const attemptHelper = new QuizAttemptHelper(studentComputer);
            const { tx, effect } = await attemptHelper.createQuizAttempt({
                studentPubKey,
                quizId: quiz.contractId,
                answerCommitment: '',
                entryFee: quiz.entryFee,
                teacher: quiz.contractId
            });
            const txId = await studentComputer.broadcast(tx);
            const attempt = effect.res;
            // Store in database
            await prisma.quizAttempt.create({
                data: {
                    contractId: attempt._id,
                    contractRev: attempt._rev,
                    txHash: txId,
                    userId: studentId,
                    quizId: quiz.id,
                    status: 'CREATED'
                }
            });
            return {
                success: true,
                attemptId: attempt._id,
                attemptRev: attempt._rev,
                txId
            };
        }
        catch (error) {
            console.error('Error in requestAttempt service:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to request attempt'
            };
        }
    }
}
//# sourceMappingURL=student-attempt.service.js.map