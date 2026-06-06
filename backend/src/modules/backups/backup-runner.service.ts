import { Injectable, Logger } from '@nestjs/common';
import { BackupJobStatus, BackupJobType, Prisma } from '@prisma/client';

import { AuditLogService } from '../../common/audit/audit-log.service';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BackupConfig } from './backup-config';
import { BackupDriveSyncService } from './backup-drive-sync.service';
import { BackupManifest, BackupStorageService } from './backup-storage.service';
import { BackupOperationsService } from './backup-operations.service';
import { BackupPgToolsService } from './backup-pg-tools.service';

export type BackupRunOptions = {
  scheduleId?: string;
  auditAction?: string;
};

@Injectable()
export class BackupRunnerService {
  private readonly logger = new Logger(BackupRunnerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly backupConfig: BackupConfig,
    private readonly storage: BackupStorageService,
    private readonly pg: BackupPgToolsService,
    private readonly operations: BackupOperationsService,
    private readonly audit: AuditLogService,
    private readonly driveSync: BackupDriveSyncService,
  ) {}

  isBusy(): boolean {
    return this.operations.isBusy();
  }

  enqueueManual(jobId: string, user: AuthPrincipal): void {
    this.enqueue(jobId, user, BackupJobType.manual, { auditAction: 'backup.created' });
  }

  /** Awaitable path for the in-process scheduler (BACKUP-4A). */
  async runScheduledBackup(
    jobId: string,
    user: AuthPrincipal,
    scheduleId: string,
  ): Promise<void> {
    if (!this.operations.tryAcquire(jobId)) {
      await this.markFailed(jobId, 'Another backup operation is already running.');
      throw new Error('Another backup operation is already running.');
    }
    try {
      await this.runBackup(jobId, user, BackupJobType.scheduled, {
        scheduleId,
        auditAction: 'backup.schedule.executed',
      });
    } finally {
      this.operations.release(jobId);
    }
  }

  private enqueue(
    jobId: string,
    user: AuthPrincipal,
    type: BackupJobType,
    options: BackupRunOptions,
  ): void {
    if (!this.operations.tryAcquire(jobId)) {
      void this.markFailed(jobId, 'Another backup operation is already running.');
      return;
    }

    void this.runBackup(jobId, user, type, options).finally(() => {
      this.operations.release(jobId);
    });
  }

  private async runBackup(
    jobId: string,
    user: AuthPrincipal,
    type: BackupJobType,
    options: BackupRunOptions,
  ): Promise<void> {
    try {
      await this.storage.ensureJobDir(jobId);
      const artifactPath = this.storage.jobDirectory(jobId);
      const dumpFilename = `${jobId}.dump`;
      const dumpPath = this.storage.dumpPath(jobId);

      await this.prisma.backupJob.update({
        where: { id: jobId },
        data: {
          status: BackupJobStatus.running,
          startedAt: new Date(),
          progressPercent: 5,
          artifactPath,
          dumpFilename,
        },
      });

      const dbName = this.pg.parseDbName(this.pg.getDatabaseUrl());
      const estimatedBytes = await this.pg.estimateDatabaseBytes(dbName);

      await this.pg.runPgDump(
        dumpPath,
        (bytes) => {
          const pct = this.estimateProgress(bytes, estimatedBytes);
          void this.updateProgress(jobId, pct, bytes).catch(() => undefined);
        },
        estimatedBytes,
      );

      const sizeBytes = await this.storage.fileSize(dumpPath);
      if (sizeBytes <= 0) throw new Error('pg_dump produced an empty file.');

      await this.updateProgress(jobId, 92, sizeBytes);

      const checksumSha256 = await this.storage.sha256File(dumpPath);
      const row = await this.prisma.backupJob.findUnique({
        where: { id: jobId },
        select: { label: true },
      });

      const manifest: BackupManifest = {
        backupId: jobId,
        type,
        label: row?.label ?? null,
        environmentId: this.backupConfig.environmentId,
        dbName,
        pgVersion: await this.pg.queryPgVersion(),
        schemaMigration: await this.pg.latestMigrationName(),
        sizeBytes,
        checksumSha256,
        dumpFilename,
        createdAt: new Date().toISOString(),
        createdByUserId: user.id,
        createdByEmail: user.email ?? `user-${user.id}`,
      };

      await this.storage.writeManifest(jobId, manifest);
      await this.updateProgress(jobId, 98, sizeBytes);

      await this.prisma.backupJob.update({
        where: { id: jobId },
        data: {
          status: BackupJobStatus.completed,
          progressPercent: 100,
          bytesWritten: BigInt(sizeBytes),
          manifest: manifest as unknown as Prisma.InputJsonValue,
          completedAt: new Date(),
          errorMessage: null,
        },
      });

      const auditAction = options.auditAction ?? 'backup.created';
      await this.audit.log(
        this.audit.fromPrincipal(user, {
          action: auditAction,
          resourceType: 'backup_job',
          resourceId: jobId,
          newState: {
            message: `${user.email ?? user.id} completed ${type} backup ${jobId}`,
            backupId: jobId,
            scheduleId: options.scheduleId ?? null,
            label: manifest.label,
            sizeBytes,
            checksumSha256,
            dbName,
            environmentId: manifest.environmentId,
          },
        }),
      );

      this.logger.log(`Backup ${jobId} (${type}) completed (${sizeBytes} bytes)`);
      this.driveSync.enqueue(jobId, user);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Backup ${jobId} (${type}) failed: ${message}`);
      await this.markFailed(jobId, message);
      await this.storage.removeJobArtifacts(jobId).catch(() => undefined);
      throw err;
    }
  }

  private estimateProgress(bytesWritten: number, estimatedBytes: number): number {
    if (estimatedBytes > 0 && bytesWritten > 0) {
      return Math.min(90, 5 + Math.floor((bytesWritten / estimatedBytes) * 85));
    }
    if (bytesWritten > 0) return Math.min(85, 10 + Math.floor(bytesWritten / 1_000_000) * 5);
    return 10;
  }

  private async updateProgress(
    jobId: string,
    progressPercent: number,
    bytesWritten: number,
  ): Promise<void> {
    await this.prisma.backupJob.update({
      where: { id: jobId },
      data: {
        progressPercent: Math.max(0, Math.min(100, progressPercent)),
        bytesWritten: BigInt(Math.max(0, bytesWritten)),
      },
    });
  }

  async markFailed(jobId: string, errorMessage: string): Promise<void> {
    await this.prisma.backupJob.update({
      where: { id: jobId },
      data: {
        status: BackupJobStatus.failed,
        errorMessage,
        completedAt: new Date(),
      },
    });
  }
}
