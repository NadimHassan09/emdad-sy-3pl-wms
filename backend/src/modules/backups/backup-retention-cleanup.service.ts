import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { UserRole } from '@prisma/client';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BackupConfig } from './backup-config';
import { BackupOperationsService } from './backup-operations.service';
import { BackupRetentionService } from './backup-retention.service';
import { BackupRunnerService } from './backup-runner.service';

/**
 * Daily retention cleanup (BACKUP-4B). Runs when no other backup operation is active.
 */
@Injectable()
export class BackupRetentionCleanupService {
  private readonly logger = new Logger(BackupRetentionCleanupService.name);
  private cleanupInFlight = false;
  private systemPrincipal: AuthPrincipal | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly backupConfig: BackupConfig,
    private readonly operations: BackupOperationsService,
    private readonly runner: BackupRunnerService,
    private readonly retention: BackupRetentionService,
  ) {}

  /** 05:15 server local time — after typical nightly scheduled backups. */
  @Cron('15 5 * * *')
  async runScheduledCleanup(): Promise<void> {
    if (!this.backupConfig.enabled || !this.backupConfig.retentionCleanupEnabled) {
      return;
    }

    if (this.cleanupInFlight) return;
    if (this.operations.isBusy() || this.runner.isBusy()) {
      this.logger.debug('Skipping retention cleanup — backup operation active.');
      return;
    }

    const principal = await this.resolveSystemPrincipal();
    if (!principal) {
      this.logger.warn('Skipping retention cleanup — no active super_admin system user.');
      return;
    }

    this.cleanupInFlight = true;
    try {
      await this.retention.executeCleanup(principal);
    } catch (err) {
      this.logger.error(
        `Retention cleanup failed: ${err instanceof Error ? err.message : String(err)}`,
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
