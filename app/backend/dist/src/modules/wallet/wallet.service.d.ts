export declare class WalletService {
    private prisma;
    constructor();
    getBalance(userId: string): Promise<{
        address: string | null;
        balance: number;
        balanceSats: number;
        balanceBTC: number;
    }>;
    fundWallet(userId: string, amount?: number): Promise<{
        message: string;
        address: string | null;
        fundedAmount: number;
        newBalance: number;
    }>;
}
