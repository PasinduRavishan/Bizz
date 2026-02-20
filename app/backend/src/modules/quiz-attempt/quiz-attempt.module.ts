import { Module } from '@nestjs/common'
import { QuizAttemptController } from './quiz-attempt.controller'
import { QuizAttemptService } from './quiz-attempt.service'
import { AuthModule } from '../auth/auth.module'

@Module({
  imports: [AuthModule],
  controllers: [QuizAttemptController],
  providers: [QuizAttemptService],
  exports: [QuizAttemptService],
})
export class QuizAttemptModule {}
