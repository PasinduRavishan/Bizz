import { Token } from './Token';
export declare class Quiz extends Token {
    _id: string;
    _rev: string;
    _satoshis: bigint;
    teacher: string;
    originalQuizId: string;
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
    /**
     * Constructor - Creates Quiz as fungible token
     *
     * @param to - Token owner (teacher for new quiz, student for transferred tokens)
     * @param initialSupply - Initial supply of quiz tokens (0 for on-demand minting)
     * @param symbol - Token symbol (e.g., "MATH101")
     * @param teacher - Teacher's public key (metadata, not ownership)
     * @param questionHashIPFS - IPFS hash of encrypted questions
     * @param answerHashes - Array of hashed answers
     * @param prizePool - Total prize pool in satoshis
     * @param entryFee - Entry fee per student in satoshis
     * @param passThreshold - Pass percentage (0-100)
     * @param deadline - Quiz deadline timestamp
     * @param teacherRevealDeadline - Deadline for teacher to reveal answers
     * @param originalQuizId - Original quiz ID (for transferred tokens, empty string for new quiz)
     */
    constructor(to: string, initialSupply: bigint, symbol: string, teacher: string, questionHashIPFS: string, answerHashes: string[], prizePool: bigint, entryFee: bigint, passThreshold: number, deadline: number, teacherRevealDeadline?: number | null, originalQuizId?: string);
    mint(to: string, amount: bigint): Quiz;
    transfer(recipient: string, amount: bigint): Quiz;
    burn(): void;
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
        tokenAmount: bigint;
        symbol: string;
        isActive: boolean;
        canReveal: boolean;
        isExpired: boolean;
    };
}
export declare class QuizHelper {
    computer: any;
    mod?: string;
    constructor(computer: any, mod?: string);
    deploy(Token: any, Quiz: any): Promise<string | undefined>;
    validateQuizParams(params: {
        teacherPubKey: string;
        initialSupply: bigint;
        symbol: string;
        questionHashIPFS: string;
        answerHashes: string[];
        prizePool: bigint;
        entryFee: bigint;
        passThreshold: number;
        deadline: number;
        teacherRevealDeadline: number;
    }): void;
    createQuiz(params: {
        teacherPubKey: string;
        initialSupply: bigint;
        symbol: string;
        questionHashIPFS: string;
        answerHashes: string[];
        prizePool: bigint;
        entryFee: bigint;
        passThreshold: number;
        deadline: number;
        teacherRevealDeadline: number;
    }): Promise<{
        tx: any;
        effect: any;
    }>;
}
//# sourceMappingURL=Quiz.d.ts.map