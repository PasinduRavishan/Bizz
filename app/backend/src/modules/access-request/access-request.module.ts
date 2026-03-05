import { Module } from '@nestjs/common';
import { AccessRequestController } from './access-request.controller';
import { AccessRequestService } from './access-request.service';
import { AuthModule } from '../auth/auth.module';
import { QuizModule } from '../quiz/quiz.module';

/**
 * AccessRequestModule - Manages quiz access request flow
 *
 * Imports:
 * - AuthModule for JWT auth
 * - QuizModule for TeacherGuard
 */
@Module({
  imports: [AuthModule, QuizModule],
  controllers: [AccessRequestController],
  providers: [AccessRequestService],
  exports: [AccessRequestService],
})
export class AccessRequestModule {}
