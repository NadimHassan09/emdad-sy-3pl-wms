import { Injectable, Logger } from '@nestjs/common';
import { BackupJobStatus, BackupJobType, Prisma } from '@prisma/client';

import { AuditLogService } from '../../common/audit/audit-log.service';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BackupConfig } from './backup-config';
import { BackupMaintenanceService } from './backup-maintenance.service';
import { BackupManifest, BackupStorageService } from './backup-storage.service';
import { BackupOperationsService } from './backup-operations.service';
import { BackupPgToolsService } from './backup-pg-tools.service';

@Injectable()
export class BackupRestoreRunnerService {
  private readonly logger = new Logger(BackupRestoreRunnerService.name);
  private readonly progressCache = new Map<
    string,
    { progressPercent: number; bytesWritten: number; status?: BackupJobStatus; errorMessage?: string }
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly backupConfig: BackupConfig,
    private readonly storage: BackupStorageService,
    private readonly pg: BackupPgToolsService,
    private readonly maintenance: BackupMaintenanceService,
    private readonly operations: BackupOperationsService,
    private readonly audit: AuditLogService,
  ) {}

  enqueueRestore(
    restoreJobId: string,
    sourceBackupId: string,
    user: AuthPrincipal,
    createPreSnapshot: boolean,
  ): void {
    if (!this.operations.tryAcquire(restoreJobId)) {
      void this.markFailed(restoreJobId, 'Another backup operation is already running.', user.id);
      return;
    }

    void this.runRestore(restoreJobId, sourceBackupId, user, createPreSnapshot).finally(() => {
      this.operations.release(restoreJobId);
      this.maintenance.disable();
    });
  }

  private async runRestore(
    restoreJobId: string,
    sourceBackupId: string,
    user: AuthPrincipal,
    createPreSnapshot: boolean,
  ): Promise<void> {
    let preSnapshotId: string | null = null;

    try {
      this.maintenance.enable('backup_restore');

      const source = await this.prisma.backupJob.findUnique({ where: { id: sourceBackupId } });
      if (!source || source.status !== BackupJobStatus.completed) {
        throw new Error('Source backup is not available for restore.');
      }

      const sourcePath = this.storage.resolveDumpPath(
        source.artifactPath,
        source.dumpFilename,
        sourceBackupId,
      );
      const sourceSize = await this.storage.fileSize(sourcePath);
      if (sourceSize <= 0) throw new Error('Source dump file is missing on disk.');

      const validation = await this.pg.validateDumpFile(sourcePath);
      if (!validation.valid) {
        throw new Error(validation.error ?? 'Invalid dump file.');
      }

      const manifest = source.manifest as BackupManifest | null;
      if (manifest?.environmentId && manifest.environmentId !== this.backupConfig.environmentId) {
        throw new Error(
          `Backup environment "${manifest.environmentId}" does not match current "${this.backupConfig.environmentId}".`,
        );
      }
      if (manifest?.checksumSha256) {
        const actual = await this.storage.sha256File(sourcePath);
        if (actual !== manifest.checksumSha256) {
          throw new Error('Backup file checksum does not match manifest.');
        }
      }

      await this.prisma.backupJob.update({
        where: { id: restoreJobId },
        data: {
          status: BackupJobStatus.running,
          startedAt: new Date(),
          progressPercent: 5,
        },
      });

      if (createPreSnapshot || this.backupConfig.preSnapshotRequired) {
        preSnapshotId = await this.createPreSnapshot(restoreJobId, user);
        await this.updateProgress(restoreJobId, 25, 0);
      }

      await this.updateProgress(restoreJobId, 35, sourceSize);
      await this.pg.runPgRestoreFullReplace(sourcePath);
      this.setCachedProgress(restoreJobId, 75, sourceSize);

      await this.pg.runPrismaMigrateDeploy();
      this.setCachedProgress(restoreJobId, 90, sourceSize);

      await this.pg.reconnectPrisma();

      await this.persistJobCompletion(restoreJobId, user.id, {
        sourceBackupId,
        preSnapshotId,
        label: `restore:${sourceBackupId}`,
      });

      await this.audit.log(
        this.audit.fromPrincipal(user, {
          action: 'backup.restored',
          resourceType: 'backup_job',
          resourceId: restoreJobId,
          newState: {
            message: `${user.email ?? user.id} restored backup ${sourceBackupId}`,
            restoreJobId,
            sourceBackupId,
            preSnapshotId,
          },
        }),
      );

      await this.pg.invalidateAllSessions();
      this.setCachedProgress(restoreJobId, 98, sourceSize);

      this.logger.log(`Restore ${restoreJobId} completed from source ${sourceBackupId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Restore ${restoreJobId} failed: ${message}`);

      if (preSnapshotId) {
        try {
          await this.rollbackFromSnapshot(preSnapshotId, restoreJobId);
          await this.markFailed(
            restoreJobId,
            `${message} — automatic rollback from pre-snapshot ${preSnapshotId} completed.`,
            user.id,
          );
        } catch (rollbackErr) {
          const rollbackMsg =
            rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr);
          await this.markFailed(
            restoreJobId,
            `${message} — rollback failed: ${rollbackMsg}. Manual recovery required using pre-snapshot ${preSnapshotId}.`,
            user.id,
          );
        }
      } else {
        await this.markFailed(restoreJobId, message, user.id);
      }

      await this.audit.logBestEffort(
        this.audit.fromPrincipal(user, {
          action: 'backup.restore_failed',
          resourceType: 'backup_job',
          resourceId: restoreJobId,
          newState: { message, preSnapshotId, sourceBackupId },
        }),
      );
    }
  }

  private async rollbackFromSnapshot(preSnapshotId: string, restoreJobId: string): Promise<void> {
    this.logger.warn(`Rolling back restore ${restoreJobId} from pre-snapshot ${preSnapshotId}`);
    const snap = await this.prisma.backupJob.findUnique({ where: { id: preSnapshotId } });
    if (!snap?.artifactPath || !snap.dumpFilename) {
      throw new Error('Pre-snapshot artifacts are missing.');
    }
    const snapPath = this.storage.resolveDumpPath(snap.artifactPath, snap.dumpFilename, preSnapshotId);
    await this.pg.runPgRestoreFullReplace(snapPath);
    await this.pg.runPrismaMigrateDeploy();
    await this.pg.reconnectPrisma();
    await this.pg.invalidateAllSessions();
  }

  private async createPreSnapshot(parentRestoreJobId: string, user: AuthPrincipal): Promise<string> {
    const preJob = await this.prisma.backupJob.create({
      data: {
        type: BackupJobType.pre_snapshot,
        status: BackupJobStatus.running,
        label: `pre-restore:${parentRestoreJobId}`,
        triggeredByUserId: user.id,
        parentJobId: parentRestoreJobId,
        startedAt: new Date(),
        progressPercent: 0,
      },
    });

    const preId = preJob.id;
    await this.storage.ensureJobDir(preId);
    const artifactPath = this.storage.jobDirectory(preId);
    const dumpFilename = `${preId}.dump`;
    const dumpPath = this.storage.dumpPath(preId);

    const dbName = this.pg.parseDbName(this.pg.getDatabaseUrl());
    await this.pg.runPgDump(dumpPath);

    const sizeBytes = await this.storage.fileSize(dumpPath);
    const checksumSha256 = await this.storage.sha256File(dumpPath);
    const manifest: BackupManifest = {
      backupId: preId,
      type: BackupJobType.pre_snapshot,
      label: preJob.label,
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

    await this.storage.writeManifest(preId, manifest);
    await this.prisma.backupJob.update({
      where: { id: preId },
      data: {
        status: BackupJobStatus.completed,
        progressPercent: 100,
        artifactPath,
        dumpFilename,
        bytesWritten: BigInt(sizeBytes),
        manifest: manifest as unknown as Prisma.InputJsonValue,
        completedAt: new Date(),
      },
    });

    return preId;
  }

  private async updateProgress(jobId: string, progressPercent: number, bytesWritten: number): Promise<void> {
    this.setCachedProgress(jobId, progressPercent, bytesWritten);
    try {
      await this.prisma.backupJob.update({
        where: { id: jobId },
        data: {
          progressPercent: Math.max(0, Math.min(100, progressPercent)),
          bytesWritten: BigInt(Math.max(0, bytesWritten)),
        },
      });
    } catch {
      // public schema may be dropped mid-restore
    }
  }

  private setCachedProgress(jobId: string, progressPercent: number, bytesWritten: number): void {
    this.progressCache.set(jobId, {
      progressPercent: Math.max(0, Math.min(100, progressPercent)),
      bytesWritten: Math.max(0, bytesWritten),
    });
  }

  private async persistJobCompletion(
    jobId: string,
    triggeredByUserId: string,
    manifest: Record<string, unknown>,
  ): Promise<void> {
    const cached = this.progressCache.get(jobId);
    const data = {
      type: BackupJobType.restore,
      status: BackupJobStatus.completed,
      progressPercent: 100,
      bytesWritten: BigInt(cached?.bytesWritten ?? 0),
      completedAt: new Date(),
      errorMessage: null,
      manifest: manifest as unknown as Prisma.InputJsonValue,
      triggeredByUserId,
      label: String(manifest.label ?? `restore:${manifest.sourceBackupId}`),
    };

    try {
      await this.prisma.backupJob.update({ where: { id: jobId }, data });
    } catch {
      await this.prisma.backupJob.create({
        data: { id: jobId, startedAt: new Date(), ...data },
      });
    }
    this.progressCache.delete(jobId);
  }

  private async markFailed(jobId: string, errorMessage: string, triggeredByUserId: string): Promise<void> {
    this.progressCache.set(jobId, {
      progressPercent: this.progressCache.get(jobId)?.progressPercent ?? 0,
      bytesWritten: 0,
      status: BackupJobStatus.failed,
      errorMessage,
    });
    try {
      await this.pg.reconnectPrisma();
      await this.prisma.backupJob.update({
        where: { id: jobId },
        data: {
          status: BackupJobStatus.failed,
          errorMessage,
          completedAt: new Date(),
        },
      });
    } catch {
      try {
        await this.prisma.backupJob.create({
          data: {
            id: jobId,
            type: BackupJobType.restore,
            status: BackupJobStatus.failed,
            errorMessage,
            completedAt: new Date(),
            triggeredByUserId,
            label: 'restore:failed',
          },
        });
      } catch {
        // best effort
      }
    }
  }
}
