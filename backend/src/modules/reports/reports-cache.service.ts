import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';

import { RedisService } from '../../common/redis/redis.service';
import { ReportsPolicyConfig } from './reports-policy.config';

type CacheEntry<T> = { expiresAt: number; value: T };

@Injectable()
export class ReportsCacheService {
  private readonly memory = new Map<string, CacheEntry<unknown>>();

  constructor(
    private readonly redis: RedisService,
    private readonly policy: ReportsPolicyConfig,
  ) {}

  private key(namespace: string, payload: Record<string, unknown>): string {
    const hash = createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 24);
    return `reports:${namespace}:${hash}`;
  }

  async get<T>(namespace: string, payload: Record<string, unknown>): Promise<T | null> {
    const k = this.key(namespace, payload);
    if (this.redis.isEnabled()) {
      return this.redis.getJson<T>(k);
    }
    const hit = this.memory.get(k);
    if (!hit || hit.expiresAt < Date.now()) {
      this.memory.delete(k);
      return null;
    }
    return hit.value as T;
  }

  async set<T>(namespace: string, payload: Record<string, unknown>, value: T): Promise<void> {
    const k = this.key(namespace, payload);
    const ttl = this.policy.cacheTtlSec;
    if (this.redis.isEnabled()) {
      await this.redis.setJson(k, value, ttl);
      return;
    }
    this.memory.set(k, { value, expiresAt: Date.now() + ttl * 1000 });
  }
}
