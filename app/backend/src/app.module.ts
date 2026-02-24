import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { QuizModule } from './modules/quiz/quiz.module';
import { AccessRequestModule } from './modules/access-request/access-request.module';
import { QuizAttemptModule } from './modules/quiz-attempt/quiz-attempt.module';
import { PrizeModule } from './modules/prize/prize.module';
import { WalletModule } from './modules/wallet/wallet.module';

/**
 * AppModule - Root module of the application
 *
 * This is the entry point that ties all feature modules together.
 *
 * ConfigModule.forRoot() loads environment variables from .env file
 * and makes them available throughout the app via process.env
 */
@Module({
  imports: [
    // Load environment variables from .env file
    ConfigModule.forRoot({
      isGlobal: true, // Makes ConfigService available everywhere
    }),

    // Scheduler for auto-reveal cron jobs
    ScheduleModule.forRoot(),

    // Feature modules
    AuthModule,
    QuizModule,
    AccessRequestModule,
    QuizAttemptModule,
    PrizeModule,
    WalletModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
