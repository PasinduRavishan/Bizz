import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from '../auth.service';

/**
 * JWT Strategy for Passport
 *
 * This strategy tells Passport how to validate JWT tokens.
 *
 * How it works:
 * 1. Passport extracts the JWT from the Authorization header
 * 2. Passport verifies the JWT signature using the secret
 * 3. Passport calls the validate() method with the decoded payload
 * 4. The validate() method returns the user object
 * 5. NestJS attaches the user to the request object (req.user)
 *
 * This happens automatically on routes protected with @UseGuards(JwtAuthGuard)
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({
      // Extract JWT from Authorization header as Bearer token
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),

      // Don't ignore token expiration
      ignoreExpiration: false,

      // Secret key to verify the token signature
      secretOrKey: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production-please',
    });
  }

  /**
   * Validate the JWT payload
   *
   * This method is called automatically by Passport after the token
   * is verified. The payload contains whatever we put in the token
   * when we signed it (sub, email, role).
   *
   * @param payload - Decoded JWT payload
   * @returns User object (attached to req.user)
   */
  async validate(payload: any) {
    // The payload.sub contains the user ID
    const user = await this.authService.validateUser(payload.sub);

    if (!user) {
      throw new UnauthorizedException();
    }

    // This return value is attached to the request as req.user
    return user;
  }
}
