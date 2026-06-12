import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { UserRole } from '@prisma/client';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { CronLeaderService } from '../../common/cron/cron-leader.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BackupConfig } from './backup-config';
import { BackupDriveRetentionService } from './backup-drive-retention.service';
import { BackupOperationsService } from './backup-operations.service';
import { BackupRunnerService } from './backup-runner.service';

/** Daily Google Drive retention cleanup — independent from local retention (BACKUP-6B). */
@Injectable()
export class BackupDriveRetentionCleanupService {
  private readonly logger = new Logger(BackupDriveRetentionCleanupService.name);
  private cleanupInFlight = false;
  private systemPrincipal: AuthPrincipal | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly backupConfig: BackupConfig,
    private readonly operations: BackupOperationsService,
    private readonly runner: BackupRunnerService,
    private readonly driveRetention: BackupDriveRetentionService,
    private readonly cronLeader: CronLeaderService,
  ) {}

  /** 05:30 server local time — after local retention at 05:15. */
  @Cron('30 5 * * *')
  async runScheduledCleanup(): Promise<void> {
    await this.cronLeader.runExclusive('backup-drive-retention-cleanup', 7200, () =>
      this.runScheduledCleanupWork(),
    );
  }

  private async runScheduledCleanupWork(): Promise<void> {
    if (!this.backupConfig.enabled || !this.backupConfig.gdriveRetentionCleanupEnabled) return;
    if (!this.backupConfig.gdriveEnabled) return;

    if (this.cleanupInFlight) return;
    if (this.operations.isBusy() || this.runner.isBusy()) {
      this.logger.debug('Skipping drive retention cleanup — backup operation active.');
      return;
    }

    const principal = await this.resolveSystemPrincipal();
    if (!principal) {
      this.logger.warn('Skipping drive retention cleanup — no active super_admin system user.');
      return;
    }

    this.cleanupInFlight = true;
    try {
      await this.driveRetention.executeCleanup(principal);
    } catch (err) {
      this.logger.error(
        `Drive retention cleanup failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      this.cleanupInFlight = false;
    }
  }

  private async resolveSystemPrincipal(): Promise<AuthPrincipal | null> {
    if (this.systemPrincipal) return this.systemPrincipal;

    const user = await this.prisma.user.findFirst({
      where: { role: UserRole.super_admin, status: 'active' },
      orderBy: { createdAt: 'asc' },
      select: { id: true, email: true, role: true, companyId: true },
    });

    if (!user) return null;

    this.systemPrincipal = {
      id: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      tenantScope: 'all',
      authorizedCompanyIds: [],
    };

    return this.systemPrincipal;
  }
}
