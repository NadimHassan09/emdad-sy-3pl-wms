import { Module } from '@nestjs/common';

import { PrismaModule } from '../../common/prisma/prisma.module';
import { DashboardController } from './dashboard.controller';
import { DashboardRealtimeService } from './dashboard-realtime.service';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [PrismaModule],
  controllers: [DashboardController],
  providers: [DashboardService, DashboardRealtimeService],
  exports: [DashboardService],
})
export class DashboardModule {}
