import {
  Injectable,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

const MAX_PAYLOAD_BYTES = 1_000_000;

/** Application-level key prefix applied before TTL namespaces (inventory:, barcode:, …). */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly log = new Logger(RedisService.name);
  private client: Redis | null = null;
  private readonly disabled: boolean;
  private readonly keyPrefix: string;

  constructor(private readonly config: ConfigService) {
    const explicitOff =
      this.config.get<string>('REDIS_ENABLED')?.trim().toLowerCase() === 'false';
    this.disabled = explicitOff;
    this.keyPrefix = (this.config.get<string>('REDIS_KEY_PREFIX') ?? 'wms:').trim();

    if (this.disabled) {
      this.log.warn('Redis is disabled via REDIS_ENABLED=false — read caches are bypassed.');
      return;
    }

    const host = this.config.get<string>('REDIS_HOST') ?? '127.0.0.1';
    const port = Number(this.config.get<string>('REDIS_PORT') ?? 6379);
    const password =
      this.config.get<string>('REDIS_PASSWORD')?.trim() || undefined;
    const db = Number(this.config.get<string>('REDIS_DB') ?? 0);

    this.client = new Redis({
      host,
      port,
      password,
      db,
      maxRetriesPerRequest: 2,
      lazyConnect: true,
      enableReadyCheck: true,
      connectTimeout: 5_000,
    });

    this.client.on('error', (err) => {
      this.log.warn(`Redis client error (ops will degrade to DB): ${err.message}`);
    });
  }

  private k(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  isEnabled(): boolean {
    return !this.disabled && this.client != null;
  }

  async getJson<T>(key: string): Promise<T | null> {
    if (!this.client) return null;
    try {
      await this.ensureConnected();
      const raw = await this.client.get(this.k(key));
      if (raw == null) return null;
      return JSON.parse(raw) as T;
    } catch (e) {
      this.log.debug(`Redis get miss/error for ${key}: ${(e as Error).message}`);
      return null;
    }
  }

  async setJson(key: string, value: unknown, ttlSec: number): Promise<void> {
    if (!this.client) return;
    try {
      await this.ensureConnected();
      const raw = JSON.stringify(value);
      if (Buffer.byteLength(raw, 'utf8') > MAX_PAYLOAD_BYTES) {
        this.log.warn(
          `Skipping Redis SET for "${key}" — payload ${Buffer.byteLength(raw, 'utf8')} bytes exceeds ${MAX_PAYLOAD_BYTES}.`,
        );
        return;
      }
      await this.client.setex(this.k(key), Math.max(1, ttlSec), raw);
    } catch (e) {
      this.log.debug(`Redis set error for ${key}: ${(e as Error).message}`);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.client) return;
    try {
      await this.ensureConnected();
      await this.client.unlink(this.k(key));
    } catch (e) {
      this.log.debug(`Redis unlink error for ${key}: ${(e as Error).message}`);
    }
  }

  /**
   * Non-blocking SCAN + UNLINK. Never KEYS.
   */
  async deleteByPrefix(prefix: string): Promise<void> {
    if (!this.client) return;
    const pattern = `${this.k(prefix)}*`;
    try {
      await this.ensureConnected();
      let cursor = '0';
      do {
        const [next, keys] = await this.client.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          200,
        );
        cursor = next;
        if (keys.length) await this.client.unlink(...keys);
      } while (cursor !== '0');
    } catch (e) {
      this.log.debug(`Redis deleteByPrefix "${prefix}": ${(e as Error).message}`);
    }
  }

  /**
   * Read-through cache helper. Redis errors always fall through to fetchFn().
   */
  async getOrSet<T>(
    key: string,
    ttlSec: number,
    fetchFn: () => Promise<T>,
  ): Promise<T> {
    if (!this.isEnabled()) {
      return fetchFn();
    }

    try {
      const hit = await this.getJson<T>(key);
      if (hit !== null && hit !== undefined) {
        const marker = hit as unknown as { __null?: boolean };
        if (typeof hit === 'object' && marker && marker.__null === true) {
          return null as unknown as T;
        }
        return hit;
      }
    } catch {
      return fetchFn();
    }

    const fresh = await fetchFn();

    if (fresh === undefined) {
      return fresh;
    }
    if (fresh === null) {
      await this.setJson(key, { __null: true }, Math.min(ttlSec, 60));
      return fresh;
    }
    await this.setJson(key, fresh, ttlSec);
    return fresh;
  }

  private async ensureConnected(): Promise<void> {
    if (!this.client || this.disabled) return;
    if ((this.client as Redis & { status?: string }).status === 'wait') {
      await this.client.connect().catch(() => undefined);
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit().catch(() => undefined);
      this.client = null;
    }
  }
}
