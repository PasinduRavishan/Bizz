import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

/**
 * AuthModule - Organizes all auth-related code
 *
 * @Module decorator defines:
 * - imports: Other modules this module depends on
 * - controllers: Controllers that belong to this module
 * - providers: Services, strategies, guards (anything @Injectable)
 * - exports: What other modules can use from this module
 *
 * Module structure:
 * AuthModule
 * ├── imports: [PassportModule, JwtModule]
 * ├── controllers: [AuthController]
 * ├── providers: [AuthService, JwtStrategy]
 * └── exports: [AuthService] - so other modules can use it
 */
@Module({
  imports: [
    // PassportModule provides passport authentication
    PassportModule,

    // JwtModule configures JWT settings
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production-please',
      signOptions: {
        expiresIn: '7d', // Use string directly, env var would need parsing
      },
    }),
  ],

  // Controllers handle HTTP requests
  controllers: [AuthController],

  // Providers are injectable dependencies (services, strategies, etc.)
  providers: [
    AuthService,   // Business logic
    JwtStrategy,   // Passport JWT strategy
  ],

  // Export AuthService so other modules can use it
  // For example, QuizModule might need to validate users
  exports: [AuthService],
})
export class AuthModule {}
