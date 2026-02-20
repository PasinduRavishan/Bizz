import { Module } from '@nestjs/common'
import { PrizeController } from './prize.controller'
import { PrizeService } from './prize.service'
import { AuthModule } from '../auth/auth.module'

@Module({
  imports: [AuthModule],
  controllers: [PrizeController],
  providers: [PrizeService],
  exports: [PrizeService],
})
export class PrizeModule {}
