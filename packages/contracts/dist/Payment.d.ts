import { Contract } from '@bitcoin-computer/lib';
/**
 * Payment Smart Contract
 *
 * Represents a payment that can be claimed by a recipient.
 * Created during prize distribution or entry fee collection.
 */
export declare class Payment extends Contract {
    _id: string;
    _rev: string;
    _owners: string[];
    _satoshis: bigint;
    recipient: string;
    amount: bigint;
    purpose: string;
    reference: string;
    status: string;
    createdAt: number;
    claimedAt: number | null;
    constructor(recipient: string, amount: bigint, purpose: string, reference: string);
    transfer(to: string): void;
    claim(): void;
    getInfo(): {
        paymentId: string;
        recipient: string;
        amount: bigint;
        purpose: string;
        reference: string;
        status: string;
        createdAt: number;
        claimedAt: number | null;
        canClaim: boolean;
    };
}
export declare class PaymentHelper {
    computer: any;
    mod?: string;
    constructor(computer: any, mod?: string);
    deploy(): Promise<string | undefined>;
    createPayment(params: {
        recipient: string;
        amount: bigint;
        purpose: string;
        reference: string;
    }): Promise<{
        tx: any;
        effect: any;
    }>;
    claimPayment(payment: any): Promise<{
        tx: any;
        effect: any;
    }>;
}
//# sourceMappingURL=Payment.d.ts.map