import { Injectable, Logger } from '@nestjs/common';
import { BackupJobStatus, BackupJobType, Prisma } from '@prisma/client';

import { AuditLogService } from '../../common/audit/audit-log.service';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
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
  private readonly lastEmittedProgress = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly backupConfig: BackupConfig,
    private readonly storage: BackupStorageService,
    private readonly pg: BackupPgToolsService,
    private readonly operations: BackupOperationsService,
    private readonly audit: AuditLogService,
    private readonly driveSync: BackupDriveSyncService,
    private readonly realtime: RealtimeService,
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
          progressPercent: 0,
          artifactPath,
          dumpFilename,
        },
      });
      this.emitProgress(jobId, {
        status: BackupJobStatus.running,
        type,
        progressPercent: 0,
        bytesWritten: 0,
      });

      const dbName = this.pg.parseDbName(this.pg.getDatabaseUrl());
      const estimatedBytes = await this.pg.estimateDatabaseBytes(dbName);

      await this.pg.runPgDump(
        dumpPath,
        (bytes) => {
          const pct = this.estimateProgress(bytes, estimatedBytes);
          void this.updateProgress(jobId, pct, bytes, type).catch(() => undefined);
        },
        estimatedBytes,
      );

      const sizeBytes = await this.storage.fileSize(dumpPath);
      if (sizeBytes <= 0) throw new Error('pg_dump produced an empty file.');

      await this.updateProgress(jobId, 92, sizeBytes, type);

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
      await this.updateProgress(jobId, 98, sizeBytes, type);

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
      this.emitProgress(jobId, {
        status: BackupJobStatus.completed,
        type,
        progressPercent: 100,
        bytesWritten: sizeBytes,
        label: manifest.label,
      });
      this.lastEmittedProgress.delete(jobId);

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
      await this.markFailed(jobId, message, type);
      await this.storage.removeJobArtifacts(jobId).catch(() => undefined);
      throw err;
    }
  }

  private estimateProgress(bytesWritten: number, estimatedBytes: number): number {
    if (estimatedBytes > 0 && bytesWritten > 0) {
      return Math.min(90, Math.floor((bytesWritten / estimatedBytes) * 90));
    }
    if (bytesWritten > 0) return Math.min(85, 10 + Math.floor(bytesWritten / 1_000_000) * 5);
    return 0;
  }

  private async updateProgress(
    jobId: string,
    progressPercent: number,
    bytesWritten: number,
    type?: BackupJobType,
  ): Promise<void> {
    const clamped = Math.max(0, Math.min(100, progressPercent));
    await this.prisma.backupJob.update({
      where: { id: jobId },
      data: {
        progressPercent: clamped,
        bytesWritten: BigInt(Math.max(0, bytesWritten)),
      },
    });
    const last = this.lastEmittedProgress.get(jobId) ?? -1;
    if (clamped - last >= 2 || clamped >= 90) {
      this.lastEmittedProgress.set(jobId, clamped);
      this.emitProgress(jobId, {
        status: BackupJobStatus.running,
        type,
        progressPercent: clamped,
        bytesWritten,
      });
    }
  }

  async markFailed(jobId: string, errorMessage: string, type?: BackupJobType): Promise<void> {
    await this.prisma.backupJob.update({
      where: { id: jobId },
      data: {
        status: BackupJobStatus.failed,
        errorMessage,
        completedAt: new Date(),
      },
    });
    this.emitProgress(jobId, {
      status: BackupJobStatus.failed,
      type,
      errorMessage,
    });
    this.lastEmittedProgress.delete(jobId);
  }

  private emitProgress(
    jobId: string,
    payload: {
      status: string;
      type?: string;
      progressPercent?: number;
      bytesWritten?: string | number;
      errorMessage?: string | null;
      label?: string | null;
    },
  ): void {
    this.realtime.emitBackupJobProgress({ jobId, ...payload });
  }
}
