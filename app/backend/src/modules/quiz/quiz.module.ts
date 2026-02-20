import { Module } from '@nestjs/common';
import { QuizController } from './quiz.controller';
import { QuizService } from './quiz.service';
import { AuthModule } from '../auth/auth.module';

/**
 * QuizModule - Organizes quiz-related code
 *
 * Imports AuthModule to use JwtAuthGuard
 */
@Module({
  imports: [AuthModule], // Import for JWT auth guard
  controllers: [QuizController],
  providers: [QuizService],
  exports: [QuizService], // Export for other modules
})
export class QuizModule {}
