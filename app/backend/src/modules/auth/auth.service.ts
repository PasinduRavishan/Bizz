import { Injectable, ConflictException, UnauthorizedException, InternalServerErrorException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { Computer } from '@bitcoin-computer/lib';
import { SignupDto, LoginDto } from './dto';
import { computerManager } from '../../common/computer-manager';

/**
 * AuthService - Contains all authentication business logic
 *
 * @Injectable() decorator makes this class available for dependency injection.
 * This means NestJS can automatically provide this service to controllers
 * that need it.
 *
 * Services should:
 * - Handle database operations
 * - Implement business logic
 * - Throw appropriate exceptions
 * - Return clean data to controllers
 */
@Injectable()
export class AuthService {
  private prisma: PrismaClient;

  constructor(
    private jwtService: JwtService, // Injected by NestJS
  ) {
    // Initialize Prisma client
    this.prisma = new PrismaClient();
  }

  /**
   * Sign up a new user
   *
   * Steps:
   * 1. Check if user already exists
   * 2. Hash the password
   * 3. Generate Bitcoin Computer wallet
   * 4. Fund the wallet with test funds (regtest only)
   * 5. Create user in database
   * 6. Generate JWT token
   */
  async signup(signupDto: SignupDto) {
    const { email, password, name, role = 'STUDENT' } = signupDto;

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password with bcrypt (10 salt rounds)
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate Bitcoin Computer wallet
    let walletData: { mnemonic: string; address: string; publicKey: string };
    try {
      const computer = new Computer({
        chain: process.env.BC_CHAIN || 'LTC',
        network: process.env.BC_NETWORK || 'regtest',
      });

      const mnemonic = computer.getMnemonic();
      const address = computer.getAddress();
      const publicKey = computer.getPublicKey();

      // Fund wallet with test funds (regtest only)
      if (process.env.BC_NETWORK === 'regtest') {
        try {
          await computer.faucet(0.01e8); // 0.01 LTC = 1,000,000 satoshis (sufficient for multiple txs)
          console.log(`💰 Funded new wallet ${address} with 1,000,000 sats`);
        } catch (error) {
          console.warn('⚠️ Faucet funding failed:', error.message);
          // Continue anyway - user can fund manually
        }
      }

      walletData = { mnemonic, address, publicKey };
    } catch (error) {
      console.error('Wallet generation error:', error);
      throw new InternalServerErrorException('Failed to generate wallet');
    }

    // Create user in database
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash: hashedPassword,
        name,
        role,
        address: walletData.address,
        publicKey: walletData.publicKey,
        encryptedMnemonic: walletData.mnemonic, // In production, encrypt this!
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

    // Generate JWT token
    const payload = { sub: user.id, email: user.email, role: user.role };
    const access_token = await this.jwtService.signAsync(payload);

    return {
      access_token,
      user,
    };
  }

  /**
   * Log in an existing user
   *
   * Steps:
   * 1. Find user by email
   * 2. Verify password
   * 3. Generate JWT token
   */
  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // Find user by email
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate JWT token
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

  /**
   * Validate user by ID (used by JWT strategy)
   *
   * This method is called by Passport JWT strategy to validate
   * the user from the token payload.
   */
  async validateUser(userId: string) {
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
      throw new UnauthorizedException('User not found');
    }

    return user;
  }

  /**
   * Cleanup on module destroy
   */
  async onModuleDestroy() {
    await this.prisma.$disconnect();
  }
}
