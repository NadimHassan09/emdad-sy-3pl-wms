import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { RedisService } from '../redis/redis.service';

function envBool(raw: unknown, defaultValue: boolean): boolean {
  if (raw === undefined || raw === null || raw === '') return defaultValue;
  const v = String(raw).trim().toLowerCase();
  return ['true', '1', 'yes', 'on'].includes(v);
}

/**
 * Ensures scheduled jobs run on at most one cluster worker.
 * Uses Redis SET NX when available; otherwise PM2 instance 0 only.
 */
@Injectable()
export class CronLeaderService {
  private readonly log = new Logger(CronLeaderService.name);
  private readonly enabled: boolean;

  constructor(
    private readonly redis: RedisService,
    config: ConfigService,
  ) {
    this.enabled = envBool(config.get('CRON_LEADER_ENABLED'), true);
  }

  instanceId(): string {
    return process.env.NODE_APP_INSTANCE ?? '0';
  }

  isPrimaryInstance(): boolean {
    return this.instanceId() === '0';
  }

  /**
   * Run `fn` only when this worker holds the cron leader lock for `jobKey`.
   * No-op on followers; safe to call from every cluster instance.
   */
  async runExclusive<T>(
    jobKey: string,
    ttlSec: number,
    fn: () => Promise<T>,
  ): Promise<T | undefined> {
    if (!this.enabled) {
      return fn();
    }

    const acquired = await this.tryAcquire(jobKey, ttlSec);
    if (!acquired) {
      return undefined;
    }

    try {
      return await fn();
    } finally {
      await this.release(jobKey);
    }
  }

  async tryAcquire(jobKey: string, ttlSec: number): Promise<boolean> {
    if (!this.enabled) return true;

    if (this.redis.isEnabled()) {
      const token = `${this.instanceId()}:${process.pid}`;
      const ok = await this.redis.setNx(`cron:lock:${jobKey}`, token, ttlSec);
      if (ok) return true;

      const current = await this.redis.getString(`cron:lock:${jobKey}`);
      if (current === token) {
        await this.redis.expire(`cron:lock:${jobKey}`, ttlSec);
        return true;
      }
      return false;
    }

    if (!this.isPrimaryInstance()) {
      return false;
    }

    this.log.debug(
      `Cron leader fallback: Redis disabled — instance ${this.instanceId()} runs "${jobKey}".`,
    );
    return true;
  }

  async release(jobKey: string): Promise<void> {
    if (!this.redis.isEnabled()) return;
    const token = `${this.instanceId()}:${process.pid}`;
    const current = await this.redis.getString(`cron:lock:${jobKey}`);
    if (current === token) {
      await this.redis.del(`cron:lock:${jobKey}`);
    }
  }
}
