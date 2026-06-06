import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BackupDriveSyncStatus, UserRole } from '@prisma/client';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BackupConfig } from './backup-config';
import { BackupDriveSyncService } from './backup-drive-sync.service';

/**
 * Retries failed Google Drive uploads with exponential backoff (BACKUP-6B).
 */
@Injectable()
export class BackupDriveRetryService {
  private readonly logger = new Logger(BackupDriveRetryService.name);
  private retryInFlight = false;
  private systemPrincipal: AuthPrincipal | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly backupConfig: BackupConfig,
    private readonly driveSync: BackupDriveSyncService,
  ) {}

  @Cron('*/2 * * * *')
  async processRetries(): Promise<void> {
    if (!this.backupConfig.enabled || !this.backupConfig.gdriveEnabled) return;
    if (this.retryInFlight) return;

    const principal = await this.resolveSystemPrincipal();
    if (!principal) {
      this.logger.warn('Skipping drive upload retries — no active super_admin system user.');
      return;
    }

    const now = new Date();
    const candidates = await this.prisma.backupJob.findMany({
      where: {
        status: 'completed',
        gdriveSyncStatus: BackupDriveSyncStatus.failed,
        gdriveNextRetryAt: { lte: now },
        gdriveSyncAttempts: { lt: this.backupConfig.gdriveRetryMaxAttempts },
      },
      orderBy: { gdriveNextRetryAt: 'asc' },
      take: 3,
      select: { id: true },
    });

    if (candidates.length === 0) return;

    this.retryInFlight = true;
    try {
      for (const job of candidates) {
        try {
          await this.driveSync.syncJob(job.id, principal, { isRetry: true });
        } catch (err) {
          this.logger.warn(
            `Drive retry failed for ${job.id}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    } finally {
      this.retryInFlight = false;
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
