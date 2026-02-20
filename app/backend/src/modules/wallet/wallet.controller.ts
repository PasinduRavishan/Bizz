import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common'
import { WalletService } from './wallet.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { FundWalletDto } from './dto/fund-wallet.dto'

@Controller('wallet')
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  /**
   * GET /wallet/balance
   * Get user's wallet balance
   */
  @Get('balance')
  async getBalance(@Request() req: any) {
    return this.walletService.getBalance(req.user.id)
  }

  /**
   * POST /wallet/faucet
   * Fund wallet from faucet (development only)
   */
  @Post('faucet')
  async fundWallet(@Body() dto: FundWalletDto, @Request() req: any) {
    return this.walletService.fundWallet(req.user.id, dto.amount)
  }
}
