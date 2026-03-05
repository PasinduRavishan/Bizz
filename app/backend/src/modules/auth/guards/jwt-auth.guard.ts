import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * JWT Auth Guard
 *
 * This guard uses the JWT strategy we created to protect routes.
 *
 * Usage in controllers:
 * @UseGuards(JwtAuthGuard)
 * @Get('profile')
 * getProfile(@Request() req) {
 *   return req.user; // User object from JWT payload
 * }
 *
 * When applied to a route:
 * 1. Guard checks for Authorization header
 * 2. Extracts and validates JWT token
 * 3. Calls JwtStrategy.validate()
 * 4. Attaches user to req.user
 * 5. Allows request to proceed
 *
 * If token is missing/invalid, returns 401 Unauthorized
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
