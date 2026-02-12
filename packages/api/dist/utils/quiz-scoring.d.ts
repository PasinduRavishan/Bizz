/**
 * Quiz Scoring Utilities
 * Matches the test helper functions exactly
 */
export interface ScoreResult {
    correct: number;
    total: number;
    percentage: number;
}
export declare class QuizScoring {
    /**
     * Calculate score from student answers vs correct answers
     */
    static calculateScore(studentAnswers: string[], correctAnswers: string[]): ScoreResult;
    /**
     * Check if student passed based on score and threshold
     */
    static didPass(scorePercentage: number, passThreshold: number): boolean;
    /**
     * Calculate score and pass status in one call
     */
    static gradeAttempt(studentAnswers: string[], correctAnswers: string[], passThreshold: number): ScoreResult & {
        passed: boolean;
    };
}
//# sourceMappingURL=quiz-scoring.d.ts.map