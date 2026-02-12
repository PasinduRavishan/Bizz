/**
 * Quiz Access Service
 * Business logic for quiz access with entry fee payment (EXEC pattern)
 */
import { Computer } from '@bitcoin-computer/lib';
export declare class QuizAccessService {
    /**
     * Step 3a: Prepare quiz access transaction
     * Teacher creates partially signed exec transaction with mock payment
     */
    static prepareAccess(teacherComputer: Computer, params: {
        quizId: string;
    }): Promise<{
        success: boolean;
        error: string;
        partialExecTx?: undefined;
        quiz?: undefined;
    } | {
        success: boolean;
        partialExecTx: any;
        quiz: {
            id: string;
            symbol: string;
            entryFee: string;
            prizePool: string;
        };
        error?: undefined;
    }>;
    /**
     * Step 3b: Complete quiz access
     * Student creates payment, completes exec, redeems token, teacher claims entry fee
     */
    static completeAccess(studentComputer: Computer, teacherComputer: Computer, params: {
        studentId: string;
        quizId: string;
        attemptId: string;
        partialExecTx: string;
    }): Promise<{
        success: boolean;
        error: string;
        attemptId?: undefined;
        attemptRev?: undefined;
        execTxId?: undefined;
        redeemTxId?: undefined;
    } | {
        success: boolean;
        attemptId: any;
        attemptRev: any;
        execTxId: string;
        redeemTxId: string;
        error?: undefined;
    }>;
}
//# sourceMappingURL=quiz-access.service.d.ts.map