/**
 * Prize Distribution Service
 * Business logic for prize distribution via atomic swap
 */
import { Computer } from '@bitcoin-computer/lib';
export declare class PrizeDistributionService {
    /**
     * Step 6a: Winner creates AnswerProof
     */
    static createAnswerProof(studentComputer: Computer, params: {
        attemptId: string;
        answers: string[];
        score: number;
        passed: boolean;
    }): Promise<{
        success: boolean;
        error: string;
        answerProofId?: undefined;
        answerProofRev?: undefined;
        txId?: undefined;
    } | {
        success: boolean;
        answerProofId: any;
        answerProofRev: any;
        txId: string;
        error?: undefined;
    }>;
    /**
     * Step 6b: Teacher creates prize Payment
     */
    static createPrizePayment(teacherComputer: Computer, params: {
        attemptId: string;
        studentPubKey: string;
        amount: bigint;
    }): Promise<{
        success: boolean;
        error: string;
        prizePaymentId?: undefined;
        prizePaymentRev?: undefined;
        txId?: undefined;
    } | {
        success: boolean;
        prizePaymentId: any;
        prizePaymentRev: any;
        txId: string;
        error?: undefined;
    }>;
    /**
     * Step 6c: Prepare prize swap transaction
     * Teacher creates partially signed swap
     */
    static preparePrizeSwap(teacherComputer: Computer, params: {
        attemptId: string;
    }): Promise<{
        success: boolean;
        error: string;
        partialSwapTx?: undefined;
    } | {
        success: boolean;
        partialSwapTx: any;
        error?: undefined;
    }>;
    /**
     * Step 6d: Complete prize swap
     * Student funds, signs, and broadcasts
     */
    static completePrizeSwap(studentComputer: Computer, params: {
        attemptId: string;
        partialSwapTx: string;
    }): Promise<{
        success: boolean;
        error: string;
        swapTxId?: undefined;
    } | {
        success: boolean;
        swapTxId: string;
        error?: undefined;
    }>;
    /**
     * Step 6e: Claim prize payment
     * Student releases satoshis from Payment contract to wallet
     */
    static claimPrize(studentComputer: Computer, params: {
        prizePaymentId: string;
    }): Promise<{
        success: boolean;
        claimTxId: string;
        error?: undefined;
    } | {
        success: boolean;
        error: string;
        claimTxId?: undefined;
    }>;
}
//# sourceMappingURL=prize-distribution.service.d.ts.map