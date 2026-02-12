/**
 * Quiz Cryptography Utilities
 * Matches the test helper functions exactly
 */
export declare class QuizCrypto {
    /**
     * Generate a random salt for answer hashing
     */
    static generateSalt(): string;
    /**
     * Hash an answer with quiz context
     * Format: SHA256(quizId + questionIndex + answer + salt)
     */
    static hashAnswer(quizId: string, questionIndex: number, answer: string, salt: string): string;
    /**
     * Hash a commitment from answers array
     * Format: SHA256(JSON.stringify(answers) + nonce)
     */
    static hashCommitment(answers: string[], nonce: string): string;
    /**
     * Verify answer hash
     */
    static verifyAnswerHash(quizId: string, questionIndex: number, answer: string, salt: string, expectedHash: string): boolean;
    /**
     * Verify commitment
     */
    static verifyCommitment(answers: string[], nonce: string, expectedCommitment: string): boolean;
}
//# sourceMappingURL=quiz-crypto.d.ts.map