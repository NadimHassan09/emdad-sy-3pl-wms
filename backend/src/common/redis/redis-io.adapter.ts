import type { INestApplication } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import type { ServerOptions } from 'socket.io';

/**
 * Socket.IO adapter for PM2 cluster mode — broadcasts events across workers via Redis.
 */
export class RedisIoAdapter extends IoAdapter {
  private readonly log = new Logger(RedisIoAdapter.name);
  private adapterConstructor: ReturnType<typeof createAdapter> | null = null;

  constructor(private readonly nestApp: INestApplication) {
    super(nestApp);
  }

  async connectToRedis(): Promise<void> {
    const config = this.nestApp.get(ConfigService);
    const explicitOff =
      config.get<string>('REDIS_ENABLED')?.trim().toLowerCase() === 'false';
    if (explicitOff) {
      this.log.warn(
        'Redis disabled — Socket.IO runs in-process only (PM2 cluster requires REDIS_ENABLED).',
      );
      return;
    }

    const host = config.get<string>('REDIS_HOST') ?? '127.0.0.1';
    const port = Number(config.get<string>('REDIS_PORT') ?? 6379);
    const password = config.get<string>('REDIS_PASSWORD')?.trim() || undefined;
    const db = Number(config.get<string>('REDIS_DB') ?? 0);
    const keyPrefix = (config.get<string>('REDIS_KEY_PREFIX') ?? 'wms:').trim();

    const pubClient = new Redis({
      host,
      port,
      password,
      db,
      keyPrefix,
      maxRetriesPerRequest: 2,
      lazyConnect: true,
      connectTimeout: 5_000,
    });
    const subClient = pubClient.duplicate();

    try {
      await pubClient.connect();
      await subClient.connect();
    } catch (err) {
      this.log.warn(
        `Redis unavailable for Socket.IO adapter (${(err as Error).message}) — cluster broadcasts disabled until Redis is up.`,
      );
      pubClient.disconnect();
      subClient.disconnect();
      return;
    }

    this.adapterConstructor = createAdapter(pubClient, subClient);
    this.log.log('Socket.IO Redis adapter connected for cluster mode.');
  }

  createIOServer(port: number, options?: ServerOptions) {
    const server = super.createIOServer(port, options);
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }
    return server;
  }
}
