import { SubmitCommitmentDto } from './dto/submit-commitment.dto';
import { VerifyAttemptDto } from './dto/verify-attempt.dto';
export declare class QuizAttemptService {
    private prisma;
    constructor();
    private mineBlocks;
    private computeScore;
    submitCommitment(attemptId: string, studentId: string, dto: SubmitCommitmentDto): Promise<{
        message: string;
        attemptId: string;
        status: string;
    }>;
    verifyAttempt(attemptId: string, studentId: string, dto: VerifyAttemptDto): Promise<{
        message: string;
        attemptId: string;
        score: number;
        passed: boolean;
        status: string;
    }>;
    private autoCreatePrizePaymentAndSwap;
    getStudentAttempts(studentId: string): Promise<{
        attempts: {
            prizeAmount: string | null;
            quiz: {
                prizePool: string;
                prizePerWinner: string | null;
                entryFee: string;
                symbol: string;
                id: string;
                title: string | null;
                passThreshold: number;
                deadline: Date;
                contractId: string;
                questionCount: number;
                winnerCount: number;
                status: import(".prisma/client").$Enums.QuizStatus;
            };
            id: string;
            createdAt: Date;
            updatedAt: Date;
            answers: import("@prisma/client/runtime/library").JsonValue | null;
            contractId: string;
            contractRev: string | null;
            txHash: string | null;
            status: import(".prisma/client").$Enums.AttemptStatus;
            userId: string;
            quizId: string;
            quizTokenRev: string | null;
            nonce: string | null;
            answerCommitment: string | null;
            score: number | null;
            passed: boolean | null;
            answerProofId: string | null;
            prizePaymentId: string | null;
            prizePaymentRev: string | null;
            swapTxHex: string | null;
        }[];
    }>;
    getAttempt(attemptId: string, userId: string): Promise<{
        attempt: {
            prizeAmount: string | null;
            quiz: {
                prizePool: string;
                prizePerWinner: string | null;
                entryFee: string;
                symbol: string;
                id: string;
                title: string | null;
                passThreshold: number;
                deadline: Date;
                contractId: string;
                questionCount: number;
                winnerCount: number;
                status: import(".prisma/client").$Enums.QuizStatus;
                revealedAnswers: import("@prisma/client/runtime/library").JsonValue;
                teacherId: string;
            };
            student: {
                email: string | null;
                name: string | null;
                id: string;
            };
            id: string;
            createdAt: Date;
            updatedAt: Date;
            answers: import("@prisma/client/runtime/library").JsonValue | null;
            contractId: string;
            contractRev: string | null;
            txHash: string | null;
            status: import(".prisma/client").$Enums.AttemptStatus;
            userId: string;
            quizId: string;
            quizTokenRev: string | null;
            nonce: string | null;
            answerCommitment: string | null;
            score: number | null;
            passed: boolean | null;
            answerProofId: string | null;
            prizePaymentId: string | null;
            prizePaymentRev: string | null;
            swapTxHex: string | null;
        };
    }>;
}
