import { Injectable, Logger } from '@nestjs/common';
import {
  BackupDriveSyncStatus,
  BackupJobType,
  BackupStorageDestination,
  BackupStoragePolicy,
} from '@prisma/client';
import { unlink } from 'node:fs/promises';
import * as path from 'node:path';

import { AuditLogService } from '../../common/audit/audit-log.service';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BackupConfig } from './backup-config';
import { computeDriveRetryDelayMs } from './backup-drive-retry.util';
import { BackupDriveIntegrationService } from './backup-drive-integration.service';
import { BackupDriveService } from './backup-drive.service';
import { BackupFileEncryptionService } from './backup-file-encryption.service';
import { BackupStoragePolicyService } from './backup-storage-policy.service';
import { BackupStorageService } from './backup-storage.service';

const DRIVE_UPLOADABLE_TYPES: BackupJobType[] = [
  BackupJobType.manual,
  BackupJobType.scheduled,
  BackupJobType.upload,
  BackupJobType.pre_snapshot,
];

export type DriveSyncOptions = {
  isRetry?: boolean;
};

@Injectable()
export class BackupDriveSyncService {
  private readonly logger = new Logger(BackupDriveSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly backupConfig: BackupConfig,
    private readonly storage: BackupStorageService,
    private readonly integration: BackupDriveIntegrationService,
    private readonly drive: BackupDriveService,
    private readonly fileEncryption: BackupFileEncryptionService,
    private readonly storagePolicy: BackupStoragePolicyService,
    private readonly audit: AuditLogService,
  ) {}

  enqueue(jobId: string, user: AuthPrincipal): void {
    void this.enqueueInternal(jobId, user).catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Drive sync enqueue failed for ${jobId}: ${message}`);
    });
  }

  private async enqueueInternal(jobId: string, user: AuthPrincipal): Promise<void> {
    if (!this.backupConfig.gdriveEnabled) return;

    const job = await this.prisma.backupJob.findUnique({ where: { id: jobId } });
    if (!job || job.status !== 'completed') return;
    if (!this.storagePolicy.shouldSyncToDrive(job.storagePolicy)) return;

    void this.syncJob(jobId, user).catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Drive sync failed for ${jobId}: ${message}`);
    });
  }

  async syncJob(jobId: string, user: AuthPrincipal, options: DriveSyncOptions = {}): Promise<void> {
    if (!this.backupConfig.gdriveEnabled) return;

    const connected = await this.integration.isConnected();
    if (!connected) return;

    const job = await this.prisma.backupJob.findUnique({ where: { id: jobId } });
    if (!job || job.status !== 'completed') return;
    if (!DRIVE_UPLOADABLE_TYPES.includes(job.type)) return;
    if (!this.storagePolicy.shouldSyncToDrive(job.storagePolicy)) return;

    const dumpPath = this.storage.resolveDumpPath(job.artifactPath, job.dumpFilename, jobId);
    const dumpSize = await this.storage.fileSize(dumpPath);
    if (dumpSize <= 0) {
      this.logger.warn(`Skipping Drive upload for ${jobId}: local dump missing.`);
      return;
    }

    const refreshToken = await this.integration.getRefreshToken();
    const folderId = await this.integration.getFolderId();
    if (!refreshToken || !folderId) return;

    const attempt = options.isRetry ? job.gdriveSyncAttempts + 1 : Math.max(1, job.gdriveSyncAttempts + 1);

    await this.prisma.backupJob.update({
      where: { id: jobId },
      data: {
        gdriveSyncStatus: BackupDriveSyncStatus.pending,
        gdriveSyncError: null,
        gdriveNextRetryAt: null,
        gdriveSyncAttempts: attempt,
      },
    });

    if (options.isRetry) {
      await this.audit.logBestEffort(
        this.audit.fromPrincipal(user, {
          action: 'backup.drive.retry_attempted',
          resourceType: 'backup_job',
          resourceId: jobId,
          newState: {
            message: `Drive upload retry attempt ${attempt} for backup ${jobId}`,
            backupId: jobId,
            attempt,
            storagePolicy: job.storagePolicy,
          },
        }),
      );
    }

    const encFilename = `${jobId}.dump.enc`;
    const encPath = path.join(this.storage.jobDirectory(jobId), encFilename);

    try {
      const encSize = await this.fileEncryption.encryptDumpFile(dumpPath, encPath);
      if (this.backupConfig.gdriveSimulateUploadFailure) {
        throw new Error(
          'Simulated Google Drive upload failure (BACKUP_GDRIVE_SIMULATE_UPLOAD_FAILURE).',
        );
      }
      const gdriveFileId = await this.drive.uploadEncryptedDump({
        refreshToken,
        rootFolderId: folderId,
        environmentId: this.backupConfig.environmentId,
        jobId,
        encFilePath: encPath,
        encFilename,
      });

      await this.prisma.backupJob.update({
        where: { id: jobId },
        data: {
          storageDestination: BackupStorageDestination.google_drive,
          gdriveFileId,
          gdriveSyncedAt: new Date(),
          gdriveSyncStatus: BackupDriveSyncStatus.synced,
          gdriveSyncError: null,
          gdriveNextRetryAt: null,
        },
      });

      await this.audit.log(
        this.audit.fromPrincipal(user, {
          action: 'backup.drive.uploaded',
          resourceType: 'backup_job',
          resourceId: jobId,
          newState: {
            message: `${user.email ?? user.id} uploaded encrypted backup ${jobId} to Google Drive`,
            backupId: jobId,
            gdriveFileId,
            encFilename,
            encSizeBytes: encSize,
            storageDestination: BackupStorageDestination.google_drive,
            storagePolicy: job.storagePolicy,
            attempt,
          },
        }),
      );

      if (job.storagePolicy === BackupStoragePolicy.drive_only) {
        await this.purgeLocalArtifacts(jobId);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const maxAttempts = this.backupConfig.gdriveRetryMaxAttempts;
      const exhausted = attempt >= maxAttempts;
      const nextRetryAt = exhausted
        ? null
        : new Date(
            Date.now() +
              computeDriveRetryDelayMs(
                attempt,
                this.backupConfig.gdriveRetryBaseSec,
                this.backupConfig.gdriveRetryMaxSec,
              ),
          );

      await this.prisma.backupJob.update({
        where: { id: jobId },
        data: {
          gdriveSyncStatus: BackupDriveSyncStatus.failed,
          gdriveSyncError: message.slice(0, 2000),
          gdriveNextRetryAt: nextRetryAt,
        },
      });

      if (exhausted) {
        await this.audit.logBestEffort(
          this.audit.fromPrincipal(user, {
            action: 'backup.drive.upload_failed',
            resourceType: 'backup_job',
            resourceId: jobId,
            newState: {
              message: `Drive upload failed permanently for backup ${jobId}`,
              backupId: jobId,
              attempt,
              maxAttempts,
              error: message.slice(0, 500),
              storagePolicy: job.storagePolicy,
            },
          }),
        );
      } else {
        await this.audit.logBestEffort(
          this.audit.fromPrincipal(user, {
            action: 'backup.drive.retry_scheduled',
            resourceType: 'backup_job',
            resourceId: jobId,
            newState: {
              message: `Drive upload failed for backup ${jobId}; retry scheduled`,
              backupId: jobId,
              attempt,
              maxAttempts,
              nextRetryAt: nextRetryAt?.toISOString() ?? null,
              error: message.slice(0, 500),
              storagePolicy: job.storagePolicy,
            },
          }),
        );
      }

      throw err;
    } finally {
      await unlink(encPath).catch(() => undefined);
    }
  }

  private async purgeLocalArtifacts(jobId: string): Promise<void> {
    await this.storage.removeJobDirectory(jobId);
    await this.prisma.backupJob.update({
      where: { id: jobId },
      data: {
        localArtifactPurged: true,
        artifactPath: null,
        dumpFilename: null,
      },
    });
    this.logger.log(`Purged local artifacts for drive_only backup ${jobId}`);
  }
}
