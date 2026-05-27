import { Module } from '@nestjs/common';

import { PrismaModule } from '../../common/prisma/prisma.module';
import { RedisModule } from '../../common/redis/redis.module';
import { ObservabilityController } from './observability.controller';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [ObservabilityController],
})
export class ObservabilityModule {}

