import { IsString, IsNumber, IsArray, Min, Max, IsOptional, ArrayMinSize } from 'class-validator';

/**
 * DTO for creating a quiz from UI (Frontend-facing)
 *
 * Accepts questions and correctAnswers from frontend
 * Backend will handle IPFS upload and hashing
 */

interface Question {
  question: string;
  options: string[];
  correctAnswer: number;
}

export class CreateQuizUIDto {
  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @ArrayMinSize(1)
  questions: Question[]; // Frontend sends full questions

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  correctAnswers: string[]; // Correct answers to hash

  @IsNumber()
  @Min(0)
  entryFee: number; // Entry fee in satoshis

  @IsNumber()
  @Min(0)
  prizePool: number; // Prize pool in satoshis

  @IsNumber()
  @Min(0)
  @Max(100)
  passThreshold: number; // Pass percentage (0-100)

  @IsString()
  deadline: string; // ISO date string from frontend

  @IsNumber()
  @IsOptional()
  initialSupply?: number; // Initial token supply (default 1)
}
