import { Contract } from '@bitcoin-computer/lib';
export declare class AnswerProof extends Contract {
    _id: string;
    _rev: string;
    _owners: string[];
    _satoshis: bigint;
    student: string;
    quizRef: string;
    attemptRef: string;
    answers: string[];
    score: number;
    passed: boolean;
    createdAt: number;
    constructor(student: string, quizRef: string, attemptRef: string, answers: string[], score: number, passed: boolean);
    transfer(to: string): void;
    getInfo(): {
        proofId: string;
        student: string;
        quizRef: string;
        attemptRef: string;
        answers: string[];
        score: number;
        passed: boolean;
        createdAt: number;
    };
}
export declare class AnswerProofHelper {
    computer: any;
    mod?: string;
    constructor(computer: any, mod?: string);
    deploy(): Promise<string | undefined>;
    validateProofParams(params: {
        student: string;
        quizRef: string;
        attemptRef: string;
        answers: string[];
        score: number;
        passed: boolean;
    }): void;
    createAnswerProof(params: {
        student: string;
        quizRef: string;
        attemptRef: string;
        answers: string[];
        score: number;
        passed: boolean;
    }): Promise<{
        tx: any;
        effect: any;
    }>;
}
//# sourceMappingURL=AnswerProof.d.ts.map