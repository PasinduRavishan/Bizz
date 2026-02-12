/**
 * Quiz Cryptography Utilities
 * Matches the test helper functions exactly
 */
import crypto from 'crypto';
export class QuizCrypto {
    /**
     * Generate a random salt for answer hashing
     */
    static generateSalt() {
        return crypto.randomBytes(32).toString('hex');
    }
    /**
     * Hash an answer with quiz context
     * Format: SHA256(quizId + questionIndex + answer + salt)
     */
    static hashAnswer(quizId, questionIndex, answer, salt) {
        const data = `${quizId}${questionIndex}${answer}${salt}`;
        return crypto.createHash('sha256').update(data).digest('hex');
    }
    /**
     * Hash a commitment from answers array
     * Format: SHA256(JSON.stringify(answers) + nonce)
     */
    static hashCommitment(answers, nonce) {
        const data = JSON.stringify(answers) + nonce;
        return crypto.createHash('sha256').update(data).digest('hex');
    }
    /**
     * Verify answer hash
     */
    static verifyAnswerHash(quizId, questionIndex, answer, salt, expectedHash) {
        const actualHash = this.hashAnswer(quizId, questionIndex, answer, salt);
        return actualHash === expectedHash;
    }
    /**
     * Verify commitment
     */
    static verifyCommitment(answers, nonce, expectedCommitment) {
        const actualCommitment = this.hashCommitment(answers, nonce);
        return actualCommitment === expectedCommitment;
    }
}
//# sourceMappingURL=quiz-crypto.js.map