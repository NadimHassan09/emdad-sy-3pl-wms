import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { RedisModule } from '../../common/redis/redis.module';
import { ObservabilityController } from './observability.controller';
import { ObservabilityService } from './observability.service';
import { OpsPolicyConfig } from './ops-policy.config';
import { OpsProbeGuard } from './ops-probe.guard';

@Module({
  imports: [PrismaModule, RedisModule, AuthModule],
  controllers: [ObservabilityController],
  providers: [OpsPolicyConfig, OpsProbeGuard, ObservabilityService],
  exports: [OpsPolicyConfig, ObservabilityService],
})
export class ObservabilityModule {}
