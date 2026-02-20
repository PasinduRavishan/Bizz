import { IsEmail, IsString, MinLength } from 'class-validator';

/**
 * DTO for user login
 *
 * Simpler than SignupDto - only needs email and password
 */
export class LoginDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password: string;
}
