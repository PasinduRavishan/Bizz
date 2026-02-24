import { CreateAccessRequestDto } from './dto';
export declare class AccessRequestService {
    private prisma;
    private quizAccessModuleId;
    private paymentModuleId;
    private quizModuleId;
    constructor();
    private mineBlocks;
    requestAccess(studentId: string, createDto: CreateAccessRequestDto): Promise<{
        success: boolean;
        request: {
            quiz: {
                entryFee: string;
                symbol: string;
                id: string;
                title: string | null;
            };
            student: {
                email: string | null;
                name: string | null;
                id: string;
            };
            id: string;
            createdAt: Date;
            updatedAt: Date;
            status: import(".prisma/client").$Enums.QuizAccessStatus;
            quizId: string;
            studentId: string;
            partialExecTx: import("@prisma/client/runtime/library").JsonValue | null;
            approvedAt: Date | null;
            approvedBy: string | null;
            quizTokenId: string | null;
            entryPaymentId: string | null;
            paidAt: Date | null;
            feeClaimedAt: Date | null;
            attemptId: string | null;
            startedAt: Date | null;
        };
    }>;
    approveRequest(requestId: string, teacherId: string): Promise<{
        success: boolean;
        request: {
            quiz: {
                entryFee: string;
                id: string;
                title: string | null;
            };
            student: {
                email: string | null;
                name: string | null;
                id: string;
            };
            id: string;
            createdAt: Date;
            updatedAt: Date;
            status: import(".prisma/client").$Enums.QuizAccessStatus;
            quizId: string;
            studentId: string;
            partialExecTx: import("@prisma/client/runtime/library").JsonValue | null;
            approvedAt: Date | null;
            approvedBy: string | null;
            quizTokenId: string | null;
            entryPaymentId: string | null;
            paidAt: Date | null;
            feeClaimedAt: Date | null;
            attemptId: string | null;
            startedAt: Date | null;
        };
        partialTxHex: any;
        partialTx: any;
    }>;
    completePayment(requestId: string, studentId: string): Promise<{
        success: boolean;
        message: string;
        quizTokenId: any;
    }>;
    getStudentRequests(studentId: string): Promise<{
        success: boolean;
        requests: {
            quiz: {
                entryFee: string;
                symbol: string;
                id: string;
                title: string | null;
                deadline: Date;
            };
            id: string;
            createdAt: Date;
            updatedAt: Date;
            status: import(".prisma/client").$Enums.QuizAccessStatus;
            quizId: string;
            studentId: string;
            partialExecTx: import("@prisma/client/runtime/library").JsonValue | null;
            approvedAt: Date | null;
            approvedBy: string | null;
            quizTokenId: string | null;
            entryPaymentId: string | null;
            paidAt: Date | null;
            feeClaimedAt: Date | null;
            attemptId: string | null;
            startedAt: Date | null;
        }[];
    }>;
    getTeacherRequests(teacherId: string): Promise<{
        success: boolean;
        requests: {
            quiz: {
                entryFee: string;
                symbol: string;
                id: string;
                title: string | null;
            };
            student: {
                email: string | null;
                name: string | null;
                id: string;
            };
            attempt: {
                id: string;
                status: import(".prisma/client").$Enums.AttemptStatus;
                score: number | null;
                passed: boolean | null;
            } | null;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            status: import(".prisma/client").$Enums.QuizAccessStatus;
            quizId: string;
            studentId: string;
            partialExecTx: import("@prisma/client/runtime/library").JsonValue | null;
            approvedAt: Date | null;
            approvedBy: string | null;
            quizTokenId: string | null;
            entryPaymentId: string | null;
            paidAt: Date | null;
            feeClaimedAt: Date | null;
            attemptId: string | null;
            startedAt: Date | null;
        }[];
    }>;
    onModuleDestroy(): Promise<void>;
    claimPayment(requestId: string, teacherId: string): Promise<{
        success: boolean;
        message: string;
        paymentId: any;
        amount: any;
    }>;
    startAttempt(requestId: string, studentId: string): Promise<{
        success: boolean;
        message: string;
        attemptId: string;
        contractId: any;
        tokenBurned: boolean;
    }>;
}
