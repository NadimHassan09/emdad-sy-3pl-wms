import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { RedisService } from './redis.service';

/**
 * Optional read-through cache for `GET /tasks/:id` Prisma hydration (before runnability flags).
 * Bulk-invalidated via `tasks:` prefix in `CacheInvalidationService.afterTaskMutation`.
 */
@Injectable()
export class TaskReadCacheService {
  constructor(
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  isEnabled(): boolean {
    return (
      this.redis.isEnabled() &&
      this.config.get<string>('TASK_READ_CACHE')?.trim().toLowerCase() === 'true'
    );
  }

  private ttlSec(): number {
    const raw = this.config.get<string>('TASK_READ_CACHE_TTL_SEC');
    const n = raw != null && raw !== '' ? Number(raw) : 45;
    return Number.isFinite(n) && n > 0 ? Math.min(n, 300) : 45;
  }

  /** `companyId` or `_` when principal has no tenant (e.g. super_admin). */
  cacheKey(companyKey: string, taskId: string): string {
    return `tasks:v1:detail:${companyKey}:${taskId}`;
  }

  async getOrLoad<T>(companyKey: string, taskId: string, load: () => Promise<T>): Promise<T> {
    if (!this.isEnabled()) {
      return load();
    }
    return this.redis.getOrSet(this.cacheKey(companyKey, taskId), this.ttlSec(), load);
  }
}
