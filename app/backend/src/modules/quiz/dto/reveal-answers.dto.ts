import { IsArray, IsString, IsOptional } from 'class-validator';

/**
 * DTO for teacher revealing quiz answers.
 * answers and salt are optional — if omitted, the backend uses values stored in DB at quiz creation.
 */
export class RevealAnswersDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  answers?: string[];

  @IsOptional()
  @IsString()
  salt?: string;
}
