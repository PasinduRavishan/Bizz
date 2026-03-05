import { QuizService } from './quiz.service';
import { CreateQuizDto, CreateQuizUIDto, RevealAnswersDto } from './dto';
export declare class QuizController {
    private quizService;
    constructor(quizService: QuizService);
    create(req: any, createQuizDto: CreateQuizDto): Promise<{
        success: boolean;
        quiz: {
            entryFee: string;
            prizePool: string;
            teacher: {
                email: string | null;
                name: string | null;
                id: string;
                address: string | null;
            };
            symbol: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            title: string | null;
            description: string | null;
            questionHashIPFS: string;
            answerHashes: import("@prisma/client/runtime/library").JsonValue;
            passThreshold: number;
            deadline: Date;
            teacherRevealDeadline: Date;
            questions: import("@prisma/client/runtime/library").JsonValue | null;
            correctAnswers: import("@prisma/client/runtime/library").JsonValue;
            salt: string;
            contractId: string;
            contractRev: string | null;
            txHash: string | null;
            moduleSpecifier: string | null;
            questionCount: number;
            winnerCount: number;
            prizePerWinner: bigint | null;
            status: import(".prisma/client").$Enums.QuizStatus;
            revealedAnswers: import("@prisma/client/runtime/library").JsonValue | null;
            teacherId: string;
        };
    }>;
    createFromUI(req: any, createQuizUIDto: CreateQuizUIDto): Promise<{
        success: boolean;
        quizId: string;
        quiz: {
            entryFee: string;
            prizePool: string;
            teacher: {
                email: string | null;
                name: string | null;
                id: string;
                address: string | null;
            };
            symbol: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            title: string | null;
            description: string | null;
            questionHashIPFS: string;
            answerHashes: import("@prisma/client/runtime/library").JsonValue;
            passThreshold: number;
            deadline: Date;
            teacherRevealDeadline: Date;
            questions: import("@prisma/client/runtime/library").JsonValue | null;
            correctAnswers: import("@prisma/client/runtime/library").JsonValue;
            salt: string;
            contractId: string;
            contractRev: string | null;
            txHash: string | null;
            moduleSpecifier: string | null;
            questionCount: number;
            winnerCount: number;
            prizePerWinner: bigint | null;
            status: import(".prisma/client").$Enums.QuizStatus;
            revealedAnswers: import("@prisma/client/runtime/library").JsonValue | null;
            teacherId: string;
        };
    }>;
    findAll(status?: string, teacherId?: string): Promise<{
        success: boolean;
        quizzes: {
            entryFee: string;
            prizePool: string;
            prizePerWinner: string | null;
            attempts: {
                id: string;
                status: import(".prisma/client").$Enums.AttemptStatus;
                passed: boolean | null;
                answerProofId: string | null;
                prizePaymentId: string | null;
                swapTxHex: string | null;
            }[];
            _count: {
                attempts: number;
                accessRequests: number;
            };
            teacher: {
                email: string | null;
                name: string | null;
                id: string;
                address: string | null;
            };
            symbol: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            title: string | null;
            description: string | null;
            questionHashIPFS: string;
            answerHashes: import("@prisma/client/runtime/library").JsonValue;
            passThreshold: number;
            deadline: Date;
            teacherRevealDeadline: Date;
            questions: import("@prisma/client/runtime/library").JsonValue | null;
            correctAnswers: import("@prisma/client/runtime/library").JsonValue;
            salt: string;
            contractId: string;
            contractRev: string | null;
            txHash: string | null;
            moduleSpecifier: string | null;
            questionCount: number;
            winnerCount: number;
            status: import(".prisma/client").$Enums.QuizStatus;
            revealedAnswers: import("@prisma/client/runtime/library").JsonValue | null;
            teacherId: string;
        }[];
    }>;
    findOne(id: string, req: any): Promise<{
        success: boolean;
        quiz: {
            teacher: {
                email: string | null;
                name: string | null;
                id: string;
            };
            entryFee: string;
            prizePool: string;
            prizePerWinner: string | null;
            blockchainStatus: any;
            answerHashes: any;
            revealedAnswers: any;
            attempts: {
                id: string;
                createdAt: Date;
                contractId: string;
                status: import(".prisma/client").$Enums.AttemptStatus;
                score: number | null;
                passed: boolean | null;
                answerProofId: string | null;
                prizePaymentId: string | null;
                swapTxHex: string | null;
                student: {
                    email: string | null;
                    name: string | null;
                    id: string;
                };
            }[];
            symbol: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            title: string | null;
            description: string | null;
            questionHashIPFS: string;
            passThreshold: number;
            deadline: Date;
            teacherRevealDeadline: Date;
            questions: import("@prisma/client/runtime/library").JsonValue | null;
            correctAnswers: import("@prisma/client/runtime/library").JsonValue;
            salt: string;
            contractId: string;
            contractRev: string | null;
            txHash: string | null;
            moduleSpecifier: string | null;
            questionCount: number;
            winnerCount: number;
            status: import(".prisma/client").$Enums.QuizStatus;
            teacherId: string;
        };
    } | {
        success: boolean;
        quiz: {
            teacher: {
                email: string | null;
                name: string | null;
                id: string;
            };
            entryFee: string;
            prizePool: string;
            prizePerWinner: string | null;
            warning: string;
            attempts: {
                id: string;
                createdAt: Date;
                contractId: string;
                status: import(".prisma/client").$Enums.AttemptStatus;
                score: number | null;
                passed: boolean | null;
                answerProofId: string | null;
                prizePaymentId: string | null;
                swapTxHex: string | null;
                student: {
                    email: string | null;
                    name: string | null;
                    id: string;
                };
            }[];
            symbol: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            title: string | null;
            description: string | null;
            questionHashIPFS: string;
            answerHashes: import("@prisma/client/runtime/library").JsonValue;
            passThreshold: number;
            deadline: Date;
            teacherRevealDeadline: Date;
            questions: import("@prisma/client/runtime/library").JsonValue | null;
            correctAnswers: import("@prisma/client/runtime/library").JsonValue;
            salt: string;
            contractId: string;
            contractRev: string | null;
            txHash: string | null;
            moduleSpecifier: string | null;
            questionCount: number;
            winnerCount: number;
            status: import(".prisma/client").$Enums.QuizStatus;
            revealedAnswers: import("@prisma/client/runtime/library").JsonValue | null;
            teacherId: string;
        };
    }>;
    revealAnswers(id: string, req: any, revealDto: RevealAnswersDto): Promise<{
        success: boolean;
        message: string;
        gradedAttempts: number;
        passedAttempts: number;
        winnerCount: number;
        prizePerWinner: string | null;
    }>;
    remove(id: string, req: any): Promise<{
        success: boolean;
        message: string;
    }>;
}
