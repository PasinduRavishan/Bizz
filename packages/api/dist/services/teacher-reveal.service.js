/**
 * Teacher Reveal Service
 * Business logic for teacher revealing answers and grading
 */
import { prisma } from '@bizz/database';
import { QuizScoring } from '../utils/quiz-scoring';
export class TeacherRevealService {
    /**
     * Step 5: Teacher reveals answers and grades attempts
     * Reveals answers on blockchain and calculates scores
     */
    static async revealAndGrade(teacherComputer, params) {
        try {
            const { teacherId, quizId, quizModuleSpec } = params;
            // Get quiz from database
            const quiz = await prisma.quiz.findUnique({
                where: { contractId: quizId },
                include: { attempts: true }
            });
            if (!quiz) {
                return { success: false, error: 'Quiz not found' };
            }
            if (quiz.status !== 'ACTIVE') {
                return { success: false, error: 'Quiz already revealed' };
            }
            // Parse correct answers and salt
            const correctAnswers = JSON.parse(quiz.correctAnswers);
            const salt = quiz.salt;
            // Sync latest quiz state
            const [latestQuizRev] = await teacherComputer.query({ ids: [quizId] });
            const syncedQuiz = await teacherComputer.sync(latestQuizRev);
            // Reveal answers on blockchain
            const { tx: revealTx } = await teacherComputer.encodeCall({
                target: syncedQuiz,
                property: 'revealAnswers',
                args: [correctAnswers, salt],
                mod: quizModuleSpec
            });
            const revealTxId = await teacherComputer.broadcast(revealTx);
            // Update quiz status
            await prisma.quiz.update({
                where: { id: quiz.id },
                data: {
                    status: 'REVEALED',
                    revealedAnswers: JSON.stringify(correctAnswers)
                }
            });
            // Grade all attempts
            const gradingResults = [];
            for (const attempt of quiz.attempts) {
                if (attempt.status === 'COMMITTED' && attempt.answers) {
                    const studentAnswers = JSON.parse(attempt.answers);
                    const gradeResult = QuizScoring.gradeAttempt(studentAnswers, correctAnswers, quiz.passThreshold);
                    gradingResults.push({
                        attemptId: attempt.contractId,
                        score: gradeResult.percentage,
                        passed: gradeResult.passed
                    });
                }
            }
            return {
                success: true,
                quizId,
                revealTxId,
                revealedAnswers: correctAnswers,
                gradingResults
            };
        }
        catch (error) {
            console.error('Error in revealAndGrade service:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to reveal and grade'
            };
        }
    }
    /**
     * Verify individual attempt after reveal
     * Student calls this to update their attempt contract
     */
    static async verifyAttempt(studentComputer, params) {
        try {
            const { attemptId, score, passed, attemptModuleSpec } = params;
            // Get attempt
            const attempt = await prisma.quizAttempt.findUnique({
                where: { contractId: attemptId }
            });
            if (!attempt) {
                return { success: false, error: 'Attempt not found' };
            }
            // Sync latest attempt
            const [latestAttemptRev] = await studentComputer.query({ ids: [attemptId] });
            const syncedAttempt = await studentComputer.sync(latestAttemptRev);
            // Verify on blockchain
            const { tx: verifyTx } = await studentComputer.encodeCall({
                target: syncedAttempt,
                property: 'verify',
                args: [score, passed],
                mod: attemptModuleSpec
            });
            const verifyTxId = await studentComputer.broadcast(verifyTx);
            // Update database
            await prisma.quizAttempt.update({
                where: { id: attempt.id },
                data: {
                    score,
                    passed,
                    status: 'VERIFIED'
                }
            });
            return {
                success: true,
                attemptId,
                score,
                passed,
                verifyTxId
            };
        }
        catch (error) {
            console.error('Error in verifyAttempt service:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to verify attempt'
            };
        }
    }
}
//# sourceMappingURL=teacher-reveal.service.js.map