import { IsNumber, Min, Max, IsOptional } from 'class-validator'

export class VerifyAttemptDto {
  // Score is now optional — backend computes it from answerCommitment + revealedAnswers
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  score?: number
}
