import { Contract } from '@bitcoin-computer/lib';
export declare class SeatToken extends Contract {
    amount: bigint;
    symbol: string;
    quizRef: string;
    _owners: string[];
    constructor(to: string, amount: bigint, symbol: string, quizRef: string);
    transfer(recipient: string, amount: bigint): SeatToken;
    burn(): void;
}
//# sourceMappingURL=SeatToken.d.ts.map