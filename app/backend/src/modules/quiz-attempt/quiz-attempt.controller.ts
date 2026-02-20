import { Controller, Post, Get, Body, Param, UseGuards, Request } from '@nestjs/common'
import { QuizAttemptService } from './quiz-attempt.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { SubmitCommitmentDto } from './dto/submit-commitment.dto'
import { VerifyAttemptDto } from './dto/verify-attempt.dto'

@Controller('quiz-attempt')
@UseGuards(JwtAuthGuard)
export class QuizAttemptController {
  constructor(private readonly quizAttemptService: QuizAttemptService) {}

  /**
   * POST /quiz-attempt/:id/submit
   * Student submits answer commitment to their QuizAttempt
   */
  @Post(':id/submit')
  async submitCommitment(
    @Param('id') attemptId: string,
    @Body() dto: SubmitCommitmentDto,
    @Request() req: any
  ) {
    return this.quizAttemptService.submitCommitment(attemptId, req.user.id, dto)
  }

  /**
   * POST /quiz-attempt/:id/verify
   * Student verifies their attempt with calculated score
   */
  @Post(':id/verify')
  async verifyAttempt(
    @Param('id') attemptId: string,
    @Body() dto: VerifyAttemptDto,
    @Request() req: any
  ) {
    return this.quizAttemptService.verifyAttempt(attemptId, req.user.id, dto)
  }

  /**
   * GET /quiz-attempt/student
   * Get all attempts for logged-in student
   */
  @Get('student')
  async getStudentAttempts(@Request() req: any) {
    return this.quizAttemptService.getStudentAttempts(req.user.id)
  }

  /**
   * GET /quiz-attempt/:id
   * Get specific attempt (student or teacher)
   */
  @Get(':id')
  async getAttempt(@Param('id') attemptId: string, @Request() req: any) {
    return this.quizAttemptService.getAttempt(attemptId, req.user.id)
  }
}
