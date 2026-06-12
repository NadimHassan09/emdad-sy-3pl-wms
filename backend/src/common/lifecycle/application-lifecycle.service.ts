import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';

/**
 * Process readiness for load balancers / PM2 `wait_ready`.
 * Mark not-ready before Nest shutdown so `/ops/health/ready` returns 503 during drain.
 */
@Injectable()
export class ApplicationLifecycleService implements OnApplicationShutdown {
  private readonly log = new Logger(ApplicationLifecycleService.name);
  private ready = false;
  private shuttingDown = false;

  markReady(): void {
    this.ready = true;
    this.shuttingDown = false;
    this.log.log(
      `Application ready (pid=${process.pid}, instance=${this.instanceId()}).`,
    );
  }

  markShuttingDown(reason?: string): void {
    if (this.shuttingDown) return;
    this.shuttingDown = true;
    this.ready = false;
    this.log.warn(
      `Draining traffic${reason ? ` (${reason})` : ''} pid=${process.pid} instance=${this.instanceId()}.`,
    );
  }

  isAcceptingTraffic(): boolean {
    return this.ready && !this.shuttingDown;
  }

  isShuttingDown(): boolean {
    return this.shuttingDown;
  }

  instanceId(): string {
    return process.env.NODE_APP_INSTANCE ?? process.env.pm_id ?? '0';
  }

  clusterInfo(): Record<string, unknown> {
    return {
      pid: process.pid,
      instanceId: this.instanceId(),
      acceptingTraffic: this.isAcceptingTraffic(),
      shuttingDown: this.shuttingDown,
    };
  }

  onApplicationShutdown(signal?: string): void {
    this.markShuttingDown(signal ?? 'application_shutdown');
  }
}
