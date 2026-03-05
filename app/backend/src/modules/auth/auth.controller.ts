import { Controller, Post, Body, Get, UseGuards, Request, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignupDto, LoginDto } from './dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

/**
 * AuthController - Handles authentication HTTP requests
 *
 * @Controller('auth') means all routes in this controller
 * will be prefixed with /auth
 *
 * So @Post('signup') becomes POST /auth/signup
 *
 * Controllers should:
 * - Define routes with decorators (@Get, @Post, etc.)
 * - Extract data from requests (@Body, @Param, @Query)
 * - Call service methods
 * - Return responses (NestJS handles JSON serialization)
 */
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}
  // NestJS automatically injects AuthService ↑

  /**
   * POST /auth/signup
   *
   * Register a new user and return JWT token
   *
   * @Body() decorator extracts the request body and validates it
   * against the SignupDto class using class-validator
   */
  @Post('signup')
  @HttpCode(HttpStatus.CREATED) // Returns 201 instead of default 200
  async signup(@Body() signupDto: SignupDto) {
    return this.authService.signup(signupDto);
  }

  /**
   * POST /auth/login
   *
   * Authenticate user and return JWT token
   *
   * @HttpCode(200) because login is not creating a resource
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  /**
   * GET /auth/profile
   *
   * Get current user profile (protected route)
   *
   * @UseGuards(JwtAuthGuard) protects this route - requires valid JWT
   * @Request() gives us access to the request object
   * req.user contains the user object from JWT payload
   */
  @Get('profile')
  @UseGuards(JwtAuthGuard)
  getProfile(@Request() req) {
    return req.user;
  }
}
