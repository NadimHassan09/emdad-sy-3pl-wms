import { Global, Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PrismaModule } from '../../common/prisma/prisma.module';
import { RedisModule } from '../../common/redis/redis.module';
import { PresenceService } from './presence.service';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeService } from './realtime.service';
import { RealtimeVersionController } from './realtime-version.controller';
import { ModuleVersionsService } from './sync/module-versions.service';
import { MutationBusService } from './sync/mutation-bus.service';
import { MutationQueueService } from './sync/mutation-queue.service';
import { RealtimeSyncModeService } from './sync/realtime-sync-mode.service';

@Global()
@Module({
  imports: [ConfigModule, PrismaModule, RedisModule],
  controllers: [RealtimeVersionController],
  providers: [
    RealtimeGateway,
    RealtimeService,
    PresenceService,
    RealtimeSyncModeService,
    ModuleVersionsService,
    MutationQueueService,
    MutationBusService,
  ],
  exports: [RealtimeService, PresenceService, MutationBusService, RealtimeSyncModeService],
})
export class RealtimeModule implements OnModuleInit {
  constructor(
    private readonly realtime: RealtimeService,
    private readonly queue: MutationQueueService,
  ) {}

  onModuleInit(): void {
    this.realtime.attachMutationQueue(this.queue);
  }
}
