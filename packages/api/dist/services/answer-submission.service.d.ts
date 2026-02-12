/**
 * Answer Submission Service
 * Business logic for student answer submission
 */
import { Computer } from '@bitcoin-computer/lib';
export declare class AnswerSubmissionService {
    /**
     * Step 4: Student submits answers
     * Creates commitment and submits to attempt contract
     */
    static submitAnswers(studentComputer: Computer, params: {
        studentId: string;
        attemptId: string;
        answers: string[];
    }): Promise<{
        success: boolean;
        error: string;
        attemptId?: undefined;
        commitment?: undefined;
        txId?: undefined;
    } | {
        success: boolean;
        attemptId: string;
        commitment: string;
        txId: string;
        error?: undefined;
    }>;
}
//# sourceMappingURL=answer-submission.service.d.ts.map