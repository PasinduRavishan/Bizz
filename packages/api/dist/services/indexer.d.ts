/**
 * Blockchain Indexer Service
 *
 * Syncs Quiz and QuizAttempt contracts from Bitcoin Computer blockchain to PostgreSQL
 * This enables fast queries, filtering, and pagination in the UI
 */
interface IndexerConfig {
    chain: 'LTC' | 'BTC' | 'DOGE';
    network: 'mainnet' | 'testnet' | 'regtest';
    url: string;
    pollInterval?: number;
    batchSize?: number;
}
export declare class BlockchainIndexer {
    private computer;
    private config;
    private isRunning;
    private syncInterval?;
    constructor(config: IndexerConfig);
    /**
     * Start continuous syncing
     */
    start(): Promise<void>;
    /**
     * Stop syncing
     */
    stop(): void;
    /**
     * Main sync function - syncs all contract types
     */
    sync(): Promise<void>;
    /**
     * Sync Quiz contracts from blockchain
     */
    private syncQuizzes;
    /**
     * Query all Quiz contracts from blockchain
     */
    private queryQuizContracts;
    /**
     * Check if an object is a Quiz contract
     */
    private isQuizContract;
    /**
     * Create a new quiz in database
     */
    private createQuiz;
    /**
     * Update existing quiz in database
     */
    private updateQuiz;
    /**
     * Sync QuizAttempt contracts from blockchain
     */
    private syncAttempts;
    /**
     * Query all QuizAttempt contracts from blockchain
     */
    private queryAttemptContracts;
    /**
     * Check if an object is a QuizAttempt contract
     */
    private isAttemptContract;
    /**
     * Create a new attempt in database
     */
    private createAttempt;
    /**
     * Update existing attempt in database
     */
    private updateAttempt;
    /**
     * Ensure user exists in database, create if not
     */
    private ensureUser;
    /**
     * Map blockchain quiz status to database enum
     */
    private mapQuizStatus;
    /**
     * Map blockchain attempt status to database enum
     */
    private mapAttemptStatus;
    /**
     * Update indexer state in database
     */
    private updateIndexerState;
    /**
     * Get indexer status
     */
    getStatus(): Promise<{
        isRunning: boolean;
        lastSync: Date;
        stats: {
            quizzes: number;
            attempts: number;
            users: number;
        };
    }>;
}
/**
 * Create indexer from environment variables
 */
export declare function createIndexerFromEnv(): BlockchainIndexer;
export {};
//# sourceMappingURL=indexer.d.ts.map