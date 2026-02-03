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
//# sourceMappingURL=Payment.d.ts.map