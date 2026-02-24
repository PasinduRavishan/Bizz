import { CreateAnswerProofDto } from './dto/create-answer-proof.dto';
export declare class PrizeService {
    private prisma;
    constructor();
    private mineBlocks;
    createAnswerProof(studentId: string, dto: CreateAnswerProofDto): Promise<{
        message: string;
        answerProofId: any;
        score: number;
        passed: true;
    }>;
    createPrizePayment(teacherId: string, attemptId: string): Promise<{
        message: string;
        prizePaymentId: any;
        amount: number;
        winnerCount: number;
    }>;
    createSwapTransaction(teacherId: string, attemptId: string): Promise<{
        message: string;
        partialTxHex: any;
    }>;
    executeSwap(studentId: string, attemptId: string): Promise<{
        message: string;
        prizePaymentId: string | null;
        status: string;
        satsClaimed: number;
    }>;
    claimPrize(studentId: string, attemptId: string): Promise<{
        message: string;
        prizePaymentId: string;
        status: any;
    }>;
}
