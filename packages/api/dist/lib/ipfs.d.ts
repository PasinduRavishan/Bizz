/**
 * IPFS utilities for Quiz Platform - Production Implementation
 * Uses Pinata for reliable IPFS uploads and multiple gateways for fetching
 */
export interface QuizQuestion {
    question: string;
    options: string[];
}
/**
 * Upload questions to IPFS via Pinata
 *
 * @param questions - Array of questions (without correct answers)
 * @returns Promise resolving to IPFS CID
 */
export declare function uploadQuestionsToIPFS(questions: QuizQuestion[]): Promise<string>;
/**
 * Fetch questions from IPFS
 *
 * @param ipfsHash - IPFS CID
 * @returns Promise resolving to questions array
 */
export declare function fetchQuestionsFromIPFS(ipfsHash: string): Promise<QuizQuestion[] | null>;
//# sourceMappingURL=ipfs.d.ts.map