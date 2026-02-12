/**
 * Quiz Scoring Utilities
 * Matches the test helper functions exactly
 */
export class QuizScoring {
    /**
     * Calculate score from student answers vs correct answers
     */
    static calculateScore(studentAnswers, correctAnswers) {
        if (studentAnswers.length !== correctAnswers.length) {
            throw new Error('Answer count mismatch');
        }
        let correct = 0;
        for (let i = 0; i < studentAnswers.length; i++) {
            if (studentAnswers[i]?.toLowerCase() === correctAnswers[i]?.toLowerCase()) {
                correct++;
            }
        }
        const total = correctAnswers.length;
        const percentage = Math.round((correct / total) * 100);
        return { correct, total, percentage };
    }
    /**
     * Check if student passed based on score and threshold
     */
    static didPass(scorePercentage, passThreshold) {
        return scorePercentage >= passThreshold;
    }
    /**
     * Calculate score and pass status in one call
     */
    static gradeAttempt(studentAnswers, correctAnswers, passThreshold) {
        const score = this.calculateScore(studentAnswers, correctAnswers);
        const passed = this.didPass(score.percentage, passThreshold);
        return { ...score, passed };
    }
}
//# sourceMappingURL=quiz-scoring.js.map