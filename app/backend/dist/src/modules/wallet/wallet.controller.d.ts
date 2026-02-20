import { WalletService } from './wallet.service';
import { FundWalletDto } from './dto/fund-wallet.dto';
export declare class WalletController {
    private readonly walletService;
    constructor(walletService: WalletService);
    getBalance(req: any): Promise<{
        address: string | null;
        balance: number;
        balanceSats: number;
        balanceBTC: number;
    }>;
    fundWallet(dto: FundWalletDto, req: any): Promise<{
        message: string;
        address: string | null;
        fundedAmount: number;
        newBalance: number;
    }>;
}
