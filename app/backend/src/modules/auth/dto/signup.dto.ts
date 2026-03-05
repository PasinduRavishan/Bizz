import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';

/**
 * DTO (Data Transfer Object) for user signup
 *
 * DTOs define the shape of data coming into our API endpoints.
 * class-validator decorators automatically validate the data:
 * - @IsEmail() ensures valid email format
 * - @MinLength() ensures minimum length
 * - @IsString() ensures the value is a string
 * - @IsOptional() makes a field optional
 */
export class SignupDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password: string;

  @IsString()
  @MinLength(2, { message: 'Name must be at least 2 characters long' })
  name: string;

  @IsString()
  @IsOptional()
  role?: 'STUDENT' | 'TEACHER';
}
