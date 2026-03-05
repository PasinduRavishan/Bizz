import { IsString, IsNotEmpty } from 'class-validator'

export class ExecuteSwapDto {
  @IsString()
  @IsNotEmpty()
  answerProofId: string

  @IsString()
  @IsNotEmpty()
  prizePaymentId: string
}
