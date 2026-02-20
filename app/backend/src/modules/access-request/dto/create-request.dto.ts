import { IsString } from 'class-validator';

/**
 * DTO for student requesting quiz access
 */
export class CreateAccessRequestDto {
  @IsString()
  quizId: string; // Database quiz ID
}
