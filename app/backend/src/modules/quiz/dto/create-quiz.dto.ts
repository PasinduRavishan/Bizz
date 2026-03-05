import { IsString, IsNumber, IsArray, Min, Max, IsOptional, ArrayMinSize } from 'class-validator';

/**
 * DTO for creating a quiz
 *
 * Based on Quiz contract constructor requirements
 */
export class CreateQuizDto {
  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  symbol: string; // Token symbol (e.g., "MATH101")

  @IsString()
  questionHashIPFS: string; // IPFS hash of encrypted questions

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  answerHashes: string[]; // Hashed answers for commit-reveal

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

  @IsNumber()
  deadline: number; // Quiz deadline timestamp

  @IsNumber()
  @IsOptional()
  teacherRevealDeadline?: number; // Deadline for teacher to reveal answers

  @IsNumber()
  @IsOptional()
  initialSupply?: number; // Initial token supply (default 1 for template)
}
