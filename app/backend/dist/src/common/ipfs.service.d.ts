export interface QuizQuestion {
    question: string;
    options: string[];
}
export declare function hashAnswer(quizId: string, index: number, answer: string, salt: string): string;
export declare function hashAnswers(answers: string[], salt: string, quizId?: string): string[];
export declare function generateSalt(): string;
export declare function uploadQuestionsToIPFS(questions: QuizQuestion[]): Promise<string>;
export declare function fetchQuestionsFromIPFS(ipfsHash: string): Promise<QuizQuestion[] | null>;
