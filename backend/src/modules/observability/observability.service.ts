import { HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import type { Request } from 'express';

import { PrismaService } from '../../common/prisma/prisma.service';
import { ApplicationLifecycleService } from '../../common/lifecycle/application-lifecycle.service';
import { RedisService } from '../../common/redis/redis.service';
import { RealtimeService } from '../realtime/realtime.service';
import { OpsPolicyConfig } from './ops-policy.config';

export type ReadinessChecks = {
  db: 'ok' | 'error';
  redis: 'ok' | 'disabled';
  websocket: 'ok' | 'error';
  process: 'ok' | 'warn';
  queues: 'ok' | 'warn' | 'error';
};

export type ReadinessResult = {
  status: 'ok';
  checks: ReadinessChecks;
  details?: Record<string, unknown>;
  timestamp: string;
};

@Injectable()
export class ObservabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly realtime: RealtimeService,
    private readonly config: ConfigService,
    private readonly policy: OpsPolicyConfig,
    private readonly lifecycle: ApplicationLifecycleService,
  ) {}

  assertLivenessEnabled(): void {
    if (!this.policy.livenessEnabled) {
      throw new NotFoundException();
    }
  }

  assertReadinessEnabled(): void {
    if (!this.policy.readinessEnabled) {
      throw new NotFoundException();
    }
  }

  assertDiagnosticsEnabled(): void {
    if (!this.policy.diagnosticsEnabled) {
      throw new NotFoundException();
    }
  }

  live(): { status: 'ok'; timestamp: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  async ready(): Promise<ReadinessResult> {
    if (!this.lifecycle.isAcceptingTraffic()) {
      const failureBody: Record<string, unknown> = {
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Application is draining or not ready.',
          details: { cluster: this.lifecycle.clusterInfo() },
        },
      };
      throw new HttpException(failureBody, HttpStatus.SERVICE_UNAVAILABLE);
    }

    const checks: ReadinessChecks = {
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

    const mem = process.memoryUsage();
    const rssMb = Math.round(mem.rss / 1024 / 1024);
    if (rssMb > 1024) {
      checks.process = 'warn';
    }

    if (this.policy.readinessVerbose) {
      details.websocket = websocket;
      details.cluster = this.lifecycle.clusterInfo();
      details.queues = {
        pending,
        inProgress,
        blocked,
        retryPending,
        retryPendingMax,
      };
      details.process = {
        uptimeSec: Math.round(process.uptime()),
        rssMb,
        heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
        pid: process.pid,
      };
    }

    if (checks.db !== 'ok' || checks.websocket === 'error' || checks.queues === 'error') {
      const failureBody: Record<string, unknown> = {
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Readiness checks failed.',
          details: this.policy.readinessVerbose
            ? { checks, ...details }
            : { checks },
        },
      };
      throw new HttpException(failureBody, HttpStatus.SERVICE_UNAVAILABLE);
    }

    const result: ReadinessResult = {
      status: 'ok',
      checks,
      timestamp: new Date().toISOString(),
    };
    if (this.policy.readinessVerbose && Object.keys(details).length > 0) {
      result.details = details;
    }
    return result;
  }

  diagnostics(req: Request): Record<string, unknown> {
    const mem = process.memoryUsage();
    const timestamp = new Date().toISOString();

    if (this.policy.isProduction) {
      return {
        service: 'backend',
        uptimeSec: Math.round(process.uptime()),
        memory: {
          rssMb: Math.round(mem.rss / 1024 / 1024),
          heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
        },
        timestamp,
      };
    }

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
      policy: this.policy.snapshot(),
      timestamp,
    };
  }
}
