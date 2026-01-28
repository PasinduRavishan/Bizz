import { Contract } from '@bitcoin-computer/lib';
export declare class Payment extends Contract {
    _id: string;
    _rev: string;
    _owners: string[];
    _satoshis: bigint;
    recipient: string;
    amount: bigint;
    claimed: boolean;
    constructor(recipient: string, amount: bigint);
    cashOut(): void;
}
//# sourceMappingURL=Payment.d.ts.map