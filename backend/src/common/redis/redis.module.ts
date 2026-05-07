import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { CacheInvalidationService } from './cache-invalidation.service';
import { TaskReadCacheService } from './task-read-cache.service';
import { RedisService } from './redis.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [RedisService, CacheInvalidationService, TaskReadCacheService],
  exports: [RedisService, CacheInvalidationService, TaskReadCacheService],
})
export class RedisModule {}
