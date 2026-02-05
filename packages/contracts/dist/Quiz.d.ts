import { Token } from './Token';
/**
 * Quiz - Fungible Token (TBC20)
 *
 * THE QUIZ ITSELF IS NOW A FUNGIBLE TOKEN!
 *
 * Key Changes from Previous Architecture:
 * - Quiz extends Token (not Contract)
 * - Quiz is fungible - teacher can mint unlimited on-demand
 * - Students buy Quiz tokens via exec (pay entry fee → get quiz token)
 * - Students redeem Quiz token → creates QuizAttempt
 * - Quiz token gets burned during redemption
 *
 * Flow:
 * 1. Teacher creates Quiz fungible token (mints initial supply or 0)
 * 2. Student requests quiz access
 * 3. Teacher mints Quiz token on-demand (via transfer)
 * 4. QuizAccess.exec() swaps quiz token for entry fee payment (atomic)
 * 5. Student redeems Quiz token → creates QuizAttempt (burns quiz token)
 * 6. Student submits answers in QuizAttempt
 * 7. Rest continues (reveal, scoring, prize swap)
 */
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
    /**
     * Mint new quiz tokens (TBC20 on-demand minting)
     * Creates NEW quiz tokens for recipient without reducing teacher's balance
     * This is true on-demand minting - teacher creates quiz tokens when student requests
     *
     * @param to - Recipient's public key (student)
     * @param amount - Amount to mint (usually 1)
     * @returns New Quiz token UTXO for recipient
     */
    mint(to: string, amount: bigint): Quiz;
    /**
     * Transfer quiz tokens to recipient (TBC20 pattern)
     * Creates new UTXO for recipient, reduces this token's amount
     * This is for splitting existing tokens, not minting new ones
     *
     * @param recipient - Recipient's public key
     * @param amount - Amount to transfer
     * @returns New Quiz token UTXO for recipient
     */
    transfer(recipient: string, amount: bigint): Quiz;
    /**
     * Burn quiz token (destroy it)
     * Used during redemption to convert quiz token into QuizAttempt
     */
    burn(): void;
    /**
     * Reveal answers (called by teacher after deadline)
     */
    revealAnswers(answers: string[], salt: string): void;
    /**
     * Distribute prizes to winners
     */
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
//# sourceMappingURL=Quiz.d.ts.map