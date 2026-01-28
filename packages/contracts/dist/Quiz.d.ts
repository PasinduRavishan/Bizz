import { Contract } from '@bitcoin-computer/lib';
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
export declare class Quiz extends Contract {
    _id: string;
    _rev: string;
    _owners: string[];
    _satoshis: bigint;
    teacher: string;
    questionHashIPFS: string;
    answerHashes: string[];
    questionCount: number;
    entryFee: bigint;
    prizePool: bigint;
    passThreshold: number;
    platformFee: number;
    deadline: number;
    teacherRevealDeadline: number;
    distributionDeadline: number;
    distributedAt: number;
    status: string;
    revealedAnswers: string[] | null;
    salt: string | null;
    winners: Array<{
        student: string;
        prizeAmount: string;
        paymentRev: string;
    }>;
    createdAt: number;
    version: string;
    constructor(teacher: string, questionHashIPFS: string, answerHashes: string[], prizePool: bigint, entryFee: bigint, passThreshold: number, deadline: number, teacherRevealDeadline?: number | null);
    getInfo(): {
        quizId: string;
        quizRev: string;
        teacher: string;
        questionHashIPFS: string;
        questionCount: number;
        entryFee: bigint;
        prizePool: bigint;
        passThreshold: number;
        deadline: number;
        teacherRevealDeadline: number;
        status: string;
        createdAt: number;
        isActive: boolean;
        canReveal: boolean;
        isExpired: boolean;
    };
    revealAnswers(answers: string[], salt: string): void;
    distributePrizes(winners?: Array<{
        student: string;
        prizeAmount: string;
        paymentRev: string;
    }>): void;
    markDistributionComplete(): void;
    complete(winners: Array<{
        student: string;
        prizeAmount: string;
        paymentRev: string;
    }>): void;
    triggerRefund(): void;
    markAbandoned(): void;
}
//# sourceMappingURL=Quiz.d.ts.map