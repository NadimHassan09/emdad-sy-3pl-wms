import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { UserRole } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { CronLeaderService } from '../../common/cron/cron-leader.service';
import { CycleCountService } from './cycle-count.service';

/**
 * Daily auto-generation of scheduled cycle counts.
 * Uses the first active internal admin as the technical `createdBy` actor.
 */
@Injectable()
export class CycleCountSchedulerService implements OnModuleInit {
  private readonly log = new Logger(CycleCountSchedulerService.name);
  private systemUserId: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cycleCounts: CycleCountService,
    private readonly cronLeader: CronLeaderService,
  ) {}

  async onModuleInit() {
    await this.resolveSystemUser();
  }

  @Cron('0 3 * * *')
  async tick() {
    await this.cronLeader.runExclusive('cycle-count-scheduler', 7200, () => this.runTick());
  }

  private async runTick() {
    try {
      const actorId = await this.resolveSystemUser();
      if (!actorId) {
        this.log.warn('Skipping cycle count scheduler — no system user available.');
        return;
      }
      const n = await this.cycleCounts.runDueSchedules(actorId);
      if (n > 0) this.log.log(`Generated ${n} scheduled cycle count(s).`);
    } catch (err) {
      this.log.error('Cycle count scheduler tick failed', err);
    }
  }

  private async resolveSystemUser(): Promise<string | null> {
    if (this.systemUserId) return this.systemUserId;
    const user = await this.prisma.user.findFirst({
      where: {
        role: { in: [UserRole.super_admin, UserRole.wh_manager] },
        status: 'active',
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    this.systemUserId = user?.id ?? null;
    return this.systemUserId;
  }
}
