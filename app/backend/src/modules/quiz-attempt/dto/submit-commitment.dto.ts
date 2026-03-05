import { IsString, IsNotEmpty } from 'class-validator'

export class SubmitCommitmentDto {
  @IsString()
  @IsNotEmpty()
  answerCommitment: string
}
