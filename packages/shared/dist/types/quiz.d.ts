export type QuizStatus = 'active' | 'revealed' | 'completed' | 'abandoned' | 'refunded';
export interface QuizMetadata {
    id: string;
    teacher: string;
    questionHashIPFS: string;
    questionCount: number;
    prizePool: bigint;
    entryFee: bigint;
    passThreshold: number;
    deadline: Date;
    status: QuizStatus;
}
//# sourceMappingURL=quiz.d.ts.map