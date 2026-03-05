import { IsString, IsNotEmpty, IsArray, IsOptional, IsNumber, IsBoolean, Min, Max } from 'class-validator'

export class CreateAnswerProofDto {
  @IsString()
  @IsNotEmpty()
  attemptId: string

  // answers, score, and passed are all optional — the backend derives them from the
  // stored answerCommitment + quiz questions.  Frontend sends an empty body.
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  answers?: string[]

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  score?: number

  @IsOptional()
  @IsBoolean()
  passed?: boolean
}
