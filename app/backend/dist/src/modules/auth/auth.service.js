"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcryptjs"));
const lib_1 = require("@bitcoin-computer/lib");
let AuthService = class AuthService {
    jwtService;
    prisma;
    constructor(jwtService) {
        this.jwtService = jwtService;
        this.prisma = new client_1.PrismaClient();
    }
    async signup(signupDto) {
        const { email, password, name, role = 'STUDENT' } = signupDto;
        const existingUser = await this.prisma.user.findUnique({
            where: { email },
        });
        if (existingUser) {
            throw new common_1.ConflictException('User with this email already exists');
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        let walletData;
        try {
            const computer = new lib_1.Computer({
                chain: process.env.BC_CHAIN || 'LTC',
                network: process.env.BC_NETWORK || 'regtest',
            });
            const mnemonic = computer.getMnemonic();
            const address = computer.getAddress();
            const publicKey = computer.getPublicKey();
            if (process.env.BC_NETWORK === 'regtest') {
                try {
                    await computer.faucet(0.01e8);
                    console.log(`💰 Funded new wallet ${address} with 1,000,000 sats`);
                }
                catch (error) {
                    console.warn('⚠️ Faucet funding failed:', error.message);
                }
            }
            walletData = { mnemonic, address, publicKey };
        }
        catch (error) {
            console.error('Wallet generation error:', error);
            throw new common_1.InternalServerErrorException('Failed to generate wallet');
        }
        const user = await this.prisma.user.create({
            data: {
                email,
                passwordHash: hashedPassword,
                name,
                role,
                address: walletData.address,
                publicKey: walletData.publicKey,
                encryptedMnemonic: walletData.mnemonic,
                walletType: 'CUSTODIAL',
            },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                address: true,
                createdAt: true,
            },
        });
        const payload = { sub: user.id, email: user.email, role: user.role };
        const access_token = await this.jwtService.signAsync(payload);
        return {
            access_token,
            user,
        };
    }
    async login(loginDto) {
        const { email, password } = loginDto;
        const user = await this.prisma.user.findUnique({
            where: { email },
        });
        if (!user || !user.passwordHash) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
        if (!isPasswordValid) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        const payload = { sub: user.id, email: user.email, role: user.role };
        const access_token = await this.jwtService.signAsync(payload);
        return {
            access_token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                address: user.address,
                createdAt: user.createdAt,
            },
        };
    }
    async validateUser(userId) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                address: true,
                createdAt: true,
            },
        });
        if (!user) {
            throw new common_1.UnauthorizedException('User not found');
        }
        return user;
    }
    async onModuleDestroy() {
        await this.prisma.$disconnect();
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [jwt_1.JwtService])
], AuthService);
//# sourceMappingURL=auth.service.js.map