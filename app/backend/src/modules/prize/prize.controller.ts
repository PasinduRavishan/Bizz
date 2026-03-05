import { Controller, Post, Body, Param, UseGuards, Request } from '@nestjs/common'
import { PrizeService } from './prize.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CreateAnswerProofDto } from './dto/create-answer-proof.dto'

@Controller('prize')
@UseGuards(JwtAuthGuard)
export class PrizeController {
  constructor(private readonly prizeService: PrizeService) {}

  /**
   * POST /prize/answer-proof
   * Winner creates AnswerProof contract
   */
  @Post('answer-proof')
  async createAnswerProof(@Body() dto: CreateAnswerProofDto, @Request() req: any) {
    return this.prizeService.createAnswerProof(req.user.id, dto)
  }

  /**
   * POST /prize/:attemptId/payment
   * Teacher creates Prize Payment for winner
   */
  @Post(':attemptId/payment')
  async createPrizePayment(@Param('attemptId') attemptId: string, @Request() req: any) {
    return this.prizeService.createPrizePayment(req.user.id, attemptId)
  }

  /**
   * POST /prize/:attemptId/swap-tx
   * Teacher creates partial SWAP transaction
   */
  @Post(':attemptId/swap-tx')
  async createSwapTransaction(@Param('attemptId') attemptId: string, @Request() req: any) {
    return this.prizeService.createSwapTransaction(req.user.id, attemptId)
  }

  /**
   * POST /prize/:attemptId/execute-swap
   * Student executes SWAP transaction
   */
  @Post(':attemptId/execute-swap')
  async executeSwap(@Param('attemptId') attemptId: string, @Request() req: any) {
    return this.prizeService.executeSwap(req.user.id, attemptId)
  }

  /**
   * POST /prize/:attemptId/claim
   * Student claims Prize Payment
   */
  @Post(':attemptId/claim')
  async claimPrize(@Param('attemptId') attemptId: string, @Request() req: any) {
    return this.prizeService.claimPrize(req.user.id, attemptId)
  }
}
