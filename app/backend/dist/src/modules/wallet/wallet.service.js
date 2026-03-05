"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalletService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const lib_1 = require("@bitcoin-computer/lib");
let WalletService = class WalletService {
    prisma;
    constructor() {
        this.prisma = new client_1.PrismaClient();
    }
    async getBalance(userId) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                encryptedMnemonic: true,
                address: true,
            },
        });
        if (!user || !user.encryptedMnemonic) {
            throw new common_1.BadRequestException('Wallet not configured');
        }
        try {
            const computer = new lib_1.Computer({
                chain: process.env.BC_CHAIN || 'LTC',
                network: process.env.BC_NETWORK || 'regtest',
                mnemonic: user.encryptedMnemonic,
            });
            const { balance } = await computer.getBalance();
            return {
                address: user.address,
                balance: Number(balance),
                balanceSats: Number(balance),
                balanceBTC: Number(balance) / 1e8,
            };
        }
        catch (error) {
            console.error('Error getting balance:', error);
            throw new common_1.BadRequestException(`Failed to get balance: ${error.message}`);
        }
    }
    async fundWallet(userId, amount) {
        if (process.env.BC_NETWORK !== 'regtest' && process.env.NODE_ENV !== 'development') {
            throw new common_1.BadRequestException('Faucet only available in development');
        }
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                encryptedMnemonic: true,
                address: true,
            },
        });
        if (!user || !user.encryptedMnemonic) {
            throw new common_1.BadRequestException('Wallet not configured');
        }
        try {
            const computer = new lib_1.Computer({
                chain: process.env.BC_CHAIN || 'LTC',
                network: process.env.BC_NETWORK || 'regtest',
                mnemonic: user.encryptedMnemonic,
            });
            const fundAmount = amount || 1000000;
            console.log(`💰 Funding wallet ${user.address} with ${fundAmount} sats...`);
            await computer.faucet(fundAmount);
            await new Promise(resolve => setTimeout(resolve, 1000));
            const { balance } = await computer.getBalance();
            console.log(`✅ Wallet funded! New balance: ${balance} sats`);
            return {
                message: 'Wallet funded successfully',
                address: user.address,
                fundedAmount: fundAmount,
                newBalance: Number(balance),
            };
        }
        catch (error) {
            console.error('Error funding wallet:', error);
            throw new common_1.BadRequestException(`Failed to fund wallet: ${error.message}`);
        }
    }
};
exports.WalletService = WalletService;
exports.WalletService = WalletService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], WalletService);
//# sourceMappingURL=wallet.service.js.map