import { PrizeService } from './prize.service';
import { CreateAnswerProofDto } from './dto/create-answer-proof.dto';
export declare class PrizeController {
    private readonly prizeService;
    constructor(prizeService: PrizeService);
    createAnswerProof(dto: CreateAnswerProofDto, req: any): Promise<{
        message: string;
        answerProofId: any;
        score: number;
        passed: true;
    }>;
    createPrizePayment(attemptId: string, req: any): Promise<{
        message: string;
        prizePaymentId: any;
        amount: number;
    }>;
    createSwapTransaction(attemptId: string, req: any): Promise<{
        message: string;
        partialTxHex: any;
    }>;
    executeSwap(attemptId: string, req: any): Promise<{
        message: string;
        prizePaymentId: string | null;
        status: string;
        satsClaimed: number;
    }>;
    claimPrize(attemptId: string, req: any): Promise<{
        message: string;
        prizePaymentId: string;
        status: any;
    }>;
}
