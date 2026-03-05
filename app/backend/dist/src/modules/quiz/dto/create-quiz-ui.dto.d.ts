interface Question {
    question: string;
    options: string[];
    correctAnswer: number;
}
export declare class CreateQuizUIDto {
    title: string;
    description?: string;
    questions: Question[];
    correctAnswers: string[];
    entryFee: number;
    prizePool: number;
    passThreshold: number;
    deadline: string;
    initialSupply?: number;
}
export {};
