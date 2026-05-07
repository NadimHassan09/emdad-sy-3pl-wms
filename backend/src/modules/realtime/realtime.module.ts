import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PrismaModule } from '../../common/prisma/prisma.module';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeService } from './realtime.service';

@Global()
@Module({
  imports: [ConfigModule, PrismaModule],
  providers: [RealtimeGateway, RealtimeService],
  exports: [RealtimeService],
})
export class RealtimeModule {}
