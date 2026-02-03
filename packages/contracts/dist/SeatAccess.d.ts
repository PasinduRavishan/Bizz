import { Contract } from '@bitcoin-computer/lib';
interface SeatToken extends Contract {
    _owners: string[];
    _satoshis: bigint;
    amount: bigint;
    symbol: string;
    quizRef: string;
    transfer(recipient: string, amount: bigint): SeatToken;
}
interface Payment extends Contract {
    _owners: string[];
    _satoshis: bigint;
    recipient: string;
    amount: bigint;
    purpose: string;
    reference: string;
    status: string;
    transfer(to: string): void;
}
export declare class SeatAccess extends Contract {
    static exec(seatToken: SeatToken, entryFeePayment: Payment): [Payment, SeatToken];
}
export {};
//# sourceMappingURL=SeatAccess.d.ts.map