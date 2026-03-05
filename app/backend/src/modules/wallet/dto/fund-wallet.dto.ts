import { IsNumber, IsOptional, Min } from 'class-validator'

export class FundWalletDto {
  @IsOptional()
  @IsNumber()
  @Min(1000)
  amount?: number // Amount in satoshis, default 1M
}
