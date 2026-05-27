import { Controller, Get, HttpException, HttpStatus, Req } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import type { Request } from 'express';

import { Public } from '../../common/auth/public.decorator';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { RealtimeService } from '../realtime/realtime.service';

@Controller('ops')
export class ObservabilityController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly realtime: RealtimeService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Get('health/live')
  live() {
    return {
      status: 'ok',
      service: 'backend',
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Get('health/ready')
  async ready() {
    const checks: {
      db: 'ok' | 'error';
      redis: 'ok' | 'disabled';
      websocket: 'ok' | 'error';
      process: 'ok' | 'warn';
      queues: 'ok' | 'warn' | 'error';
    } = {
      db: 'ok',
      redis: this.redis.isEnabled() ? 'ok' : 'disabled',
      websocket: 'ok',
      process: 'ok',
      queues: 'ok',
    };
    const details: Record<string, unknown> = {};

    try {
      await this.prisma.$queryRaw(Prisma.sql`SELECT 1`);
    } catch {
      checks.db = 'error';
    }

    const websocket = this.realtime.getHealthSnapshot();
    if (!websocket.attached) {
      checks.websocket = 'error';
    }
    details.websocket = websocket;

    const [pending, blocked, retryPending, inProgress] = await Promise.all([
      this.prisma.warehouseTask.count({ where: { status: 'pending' } }),
      this.prisma.warehouseTask.count({ where: { status: 'blocked' } }),
      this.prisma.warehouseTask.count({ where: { status: 'retry_pending' } }),
      this.prisma.warehouseTask.count({ where: { status: 'in_progress' } }),
    ]);
    const retryPendingMax = this.config.get<number>('READY_RETRY_PENDING_MAX') ?? 1000;
    if (retryPending > retryPendingMax) {
      checks.queues = 'error';
    } else if (blocked > 0) {
      checks.queues = 'warn';
    }
    details.queues = {
      pending,
      inProgress,
      blocked,
      retryPending,
      retryPendingMax,
    };

    const mem = process.memoryUsage();
    const rssMb = Math.round(mem.rss / 1024 / 1024);
    if (rssMb > 1024) {
      checks.process = 'warn';
    }
    details.process = {
      uptimeSec: Math.round(process.uptime()),
      rssMb,
      heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
      pid: process.pid,
    };

    if (checks.db !== 'ok' || checks.websocket === 'error' || checks.queues === 'error') {
      throw new HttpException(
        {
          success: false,
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'Readiness checks failed.',
            details: { checks, ...details },
          },
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    return {
      status: 'ok',
      checks,
      details,
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Get('diagnostics')
  diagnostics(@Req() req: Request) {
    const mem = process.memoryUsage();
    return {
      service: 'backend',
      env: process.env.NODE_ENV ?? 'development',
      uptimeSec: Math.round(process.uptime()),
      pid: process.pid,
      nodeVersion: process.version,
      requestId: (req.headers['x-request-id'] as string | undefined) ?? null,
      memory: {
        rss: mem.rss,
        heapUsed: mem.heapUsed,
        heapTotal: mem.heapTotal,
        external: mem.external,
      },
      timestamp: new Date().toISOString(),
    };
  }
}

