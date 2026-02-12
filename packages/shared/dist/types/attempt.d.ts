export type AttemptStatus = 'owned' | 'committed' | 'verified' | 'failed' | 'prize_claimed' | 'refunded';
export interface AttemptMetadata {
    id: string;
    student: string;
    quizRef: string;
    answerCommitment: string;
    score: number | null;
    passed: boolean | null;
    status: AttemptStatus;
}
//# sourceMappingURL=attempt.d.ts.map