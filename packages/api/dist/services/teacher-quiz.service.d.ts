/**
 * Teacher Quiz Service
 * Business logic for teacher quiz operations
 */
import { Computer } from '@bitcoin-computer/lib';
export interface CreateQuizParams {
    teacherId: string;
    symbol: string;
    questionHashIPFS: string;
    questions?: any[];
    correctAnswers: string[];
    prizePool: number;
    entryFee: number;
    passThreshold: number;
    deadline?: number;
    title?: string;
    description?: string;
}
export interface CreateQuizResult {
    success: boolean;
    quizId?: string;
    quizRev?: string;
    txId?: string;
    quiz?: any;
    error?: string;
}
export declare class TeacherQuizService {
    /**
     * Create a new quiz as a fungible token (TBC20)
     * Step 1: Teacher creates quiz
     */
    static createQuiz(teacherComputer: Computer, params: CreateQuizParams): Promise<CreateQuizResult>;
}
//# sourceMappingURL=teacher-quiz.service.d.ts.map