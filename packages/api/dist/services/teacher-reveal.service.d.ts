/**
 * Teacher Reveal Service
 * Business logic for teacher revealing answers and grading
 */
import { Computer } from '@bitcoin-computer/lib';
export declare class TeacherRevealService {
    /**
     * Step 5: Teacher reveals answers and grades attempts
     * Reveals answers on blockchain and calculates scores
     */
    static revealAndGrade(teacherComputer: Computer, params: {
        teacherId: string;
        quizId: string;
        quizModuleSpec?: string;
    }): Promise<{
        success: boolean;
        error: string;
        quizId?: undefined;
        revealTxId?: undefined;
        revealedAnswers?: undefined;
        gradingResults?: undefined;
    } | {
        success: boolean;
        quizId: string;
        revealTxId: string;
        revealedAnswers: string[];
        gradingResults: any[];
        error?: undefined;
    }>;
    /**
     * Verify individual attempt after reveal
     * Student calls this to update their attempt contract
     */
    static verifyAttempt(studentComputer: Computer, params: {
        attemptId: string;
        score: number;
        passed: boolean;
        attemptModuleSpec?: string;
    }): Promise<{
        success: boolean;
        error: string;
        attemptId?: undefined;
        score?: undefined;
        passed?: undefined;
        verifyTxId?: undefined;
    } | {
        success: boolean;
        attemptId: string;
        score: number;
        passed: boolean;
        verifyTxId: string;
        error?: undefined;
    }>;
}
//# sourceMappingURL=teacher-reveal.service.d.ts.map