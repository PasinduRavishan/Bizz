export declare class CreateQuizDto {
    title: string;
    description?: string;
    symbol: string;
    questionHashIPFS: string;
    answerHashes: string[];
    entryFee: number;
    prizePool: number;
    passThreshold: number;
    deadline: number;
    teacherRevealDeadline?: number;
    initialSupply?: number;
}
