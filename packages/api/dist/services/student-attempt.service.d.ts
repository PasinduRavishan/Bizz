/**
 * Student Attempt Service
 * Business logic for student attempt operations
 */
import { Computer } from '@bitcoin-computer/lib';
export declare class StudentAttemptService {
    /**
     * Step 2: Student requests an attempt
     * Creates a QuizAttempt contract
     */
    static requestAttempt(studentComputer: Computer, params: {
        studentId: string;
        quizId: string;
    }): Promise<{
        success: boolean;
        error: string;
        attemptId?: undefined;
        attemptRev?: undefined;
        txId?: undefined;
    } | {
        success: boolean;
        attemptId: any;
        attemptRev: any;
        txId: string;
        error?: undefined;
    }>;
}
//# sourceMappingURL=student-attempt.service.d.ts.map