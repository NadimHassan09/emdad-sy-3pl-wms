import { Injectable, Logger } from '@nestjs/common';
import {
  BackupDriveSyncStatus,
  BackupJob,
  BackupJobStatus,
  BackupJobType,
  BackupSchedule,
  BackupScheduleFrequency,
  BackupStorageDestination,
  BackupStoragePolicy,
} from '@prisma/client';

import { AuditLogService } from '../../common/audit/audit-log.service';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DRIVE_RETENTION_CLEANUP_RESOURCE_ID } from './backup-bootstrap.constants';
import { BackupConfig } from './backup-config';
import { BackupDriveIntegrationService } from './backup-drive-integration.service';
import { BackupDriveService } from './backup-drive.service';
import {
  DriveRetentionCleanupResult,
  RetentionBucket,
  RetentionProtectionReason,
} from './backup-drive-retention.types';
import { ProtectedBackupSummary, RetentionBucketSummary } from './backup-retention.types';
import { BackupOperationsService } from './backup-operations.service';

type JobWithSchedule = BackupJob & { backupSchedule: BackupSchedule | null };

const DRIVE_RETENTION_ELIGIBLE_TYPES: BackupJobType[] = [
  BackupJobType.manual,
  BackupJobType.scheduled,
  BackupJobType.upload,
];

@Injectable()
export class BackupDriveRetentionService {
  private readonly logger = new Logger(BackupDriveRetentionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly backupConfig: BackupConfig,
    private readonly integration: BackupDriveIntegrationService,
    private readonly drive: BackupDriveService,
    private readonly operations: BackupOperationsService,
    private readonly audit: AuditLogService,
  ) {}

  getPolicies() {
    return {
      keepLastDaily: this.backupConfig.gdriveKeepLastDaily,
      keepLastWeekly: this.backupConfig.gdriveKeepLastWeekly,
      keepLastMonthly: this.backupConfig.gdriveKeepLastMonthly,
      driveRetentionCleanupEnabled: this.backupConfig.gdriveRetentionCleanupEnabled,
    };
  }

  async previewCleanup(): Promise<DriveRetentionCleanupResult> {
    return this.runCleanup({ dryRun: true, principal: null });
  }

  async executeCleanup(principal: AuthPrincipal): Promise<DriveRetentionCleanupResult> {
    return this.runCleanup({ dryRun: false, principal });
  }

  private async runCleanup(opts: {
    dryRun: boolean;
    principal: AuthPrincipal | null;
  }): Promise<DriveRetentionCleanupResult> {
    if (!opts.dryRun && !opts.principal) {
      throw new Error('Drive retention cleanup requires an authenticated principal.');
    }

    const policies = this.getPolicies();
    const jobs = await this.prisma.backupJob.findMany({
      where: {
        status: BackupJobStatus.completed,
        gdriveSyncStatus: BackupDriveSyncStatus.synced,
        gdriveFileId: { not: null },
        type: { in: DRIVE_RETENTION_ELIGIBLE_TYPES },
      },
      include: { backupSchedule: true },
      orderBy: [{ gdriveSyncedAt: 'desc' }, { completedAt: 'desc' }],
    });

    const protectedMap = await this.buildProtectedSet(jobs);
    const buckets = this.buildBucketSummaries(jobs, protectedMap);

    const deleteCandidates = new Set<string>();
    for (const bucket of buckets) {
      for (const id of bucket.expiredJobIds) {
        if (!protectedMap.has(id)) deleteCandidates.add(id);
      }
    }

    const protectedSummaries = await this.summarizeProtected(protectedMap);
    const deletedDriveJobIds: string[] = [];
    const deletedJobIds: string[] = [];

    for (const jobId of [...deleteCandidates].sort()) {
      const job = jobs.find((j) => j.id === jobId);
      if (!job?.gdriveFileId) continue;

      if (opts.dryRun) {
        deletedDriveJobIds.push(jobId);
        if (job.storagePolicy === BackupStoragePolicy.drive_only) deletedJobIds.push(jobId);
        continue;
      }

      await this.deleteDriveCopy(job, opts.principal!);
      deletedDriveJobIds.push(jobId);
      if (job.storagePolicy === BackupStoragePolicy.drive_only) deletedJobIds.push(jobId);
    }

    if (!opts.dryRun && opts.principal) {
      await this.audit.log(
        this.audit.fromPrincipal(opts.principal, {
          action: 'backup.drive.retention.cleanup',
          resourceType: 'backup_drive_retention',
          resourceId: DRIVE_RETENTION_CLEANUP_RESOURCE_ID,
          newState: {
            message: `${opts.principal.email ?? opts.principal.id} ran Google Drive retention cleanup`,
            deletedDriveCount: deletedDriveJobIds.length,
            deletedJobCount: deletedJobIds.length,
            deletedDriveJobIds,
            deletedJobIds,
            policies,
            buckets: buckets.map((b) => ({
              bucket: b.bucket,
              keepLast: b.keepLast,
              expiredCount: b.expiredCount,
            })),
          },
        }),
      );
    }

    if (!opts.dryRun && deletedDriveJobIds.length > 0) {
      this.logger.log(
        `Drive retention removed ${deletedDriveJobIds.length} Drive copy/copies (${deletedJobIds.length} job rows deleted)`,
      );
    }

    return {
      dryRun: opts.dryRun,
      policies: {
        keepLastDaily: policies.keepLastDaily,
        keepLastWeekly: policies.keepLastWeekly,
        keepLastMonthly: policies.keepLastMonthly,
      },
      buckets,
      protected: protectedSummaries,
      deletedDriveCount: deletedDriveJobIds.length,
      deletedJobCount: deletedJobIds.length,
      deletedDriveJobIds,
      deletedJobIds,
    };
  }

  private buildBucketSummaries(
    jobs: JobWithSchedule[],
    protectedMap: Map<string, RetentionProtectionReason[]>,
  ): RetentionBucketSummary[] {
    const bucketDefs: { bucket: RetentionBucket; keepLast: number }[] = [
      { bucket: 'daily', keepLast: this.backupConfig.gdriveKeepLastDaily },
      { bucket: 'weekly', keepLast: this.backupConfig.gdriveKeepLastWeekly },
      { bucket: 'monthly', keepLast: this.backupConfig.gdriveKeepLastMonthly },
    ];

    return bucketDefs.map(({ bucket, keepLast }) => {
      const eligible = jobs.filter((j) => this.retentionBucket(j) === bucket);
      const retained = eligible.slice(0, keepLast);
      const retainedIds = new Set(retained.map((j) => j.id));

      for (const job of retained) {
        const reasons = protectedMap.get(job.id) ?? [];
        if (!reasons.includes('retained_in_bucket')) {
          reasons.push('retained_in_bucket');
          protectedMap.set(job.id, reasons);
        }
      }

      const expired = eligible.filter((j) => !retainedIds.has(j.id));

      return {
        bucket,
        keepLast,
        totalEligible: eligible.length,
        retainedCount: retained.length,
        expiredCount: expired.length,
        retainedJobIds: retained.map((j) => j.id),
        expiredJobIds: expired.map((j) => j.id),
      };
    });
  }

  private async buildProtectedSet(
    jobs: JobWithSchedule[],
  ): Promise<Map<string, RetentionProtectionReason[]>> {
    const protectedMap = new Map<string, RetentionProtectionReason[]>();

    const add = (id: string, reason: RetentionProtectionReason) => {
      const existing = protectedMap.get(id) ?? [];
      if (!existing.includes(reason)) existing.push(reason);
      protectedMap.set(id, existing);
    };

    const latest = jobs[0];
    if (latest) add(latest.id, 'latest_successful');

    const activeJobs = await this.prisma.backupJob.findMany({
      where: { status: { in: [BackupJobStatus.pending, BackupJobStatus.running] } },
      select: { id: true, parentJobId: true, type: true, manifest: true },
    });

    const memActive = this.operations.getActiveJobId();
    if (memActive) add(memActive, 'active_operation');

    for (const job of activeJobs) {
      add(job.id, 'active_operation');
      if (job.parentJobId) add(job.parentJobId, 'active_operation');
    }

    return protectedMap;
  }

  private async summarizeProtected(
    protectedMap: Map<string, RetentionProtectionReason[]>,
  ): Promise<ProtectedBackupSummary[]> {
    const ids = [...protectedMap.keys()];
    if (ids.length === 0) return [];

    const rows = await this.prisma.backupJob.findMany({
      where: { id: { in: ids } },
      select: { id: true, type: true, label: true, gdriveSyncedAt: true, completedAt: true },
    });
    const byId = new Map(rows.map((j) => [j.id, j]));

    return ids
      .map((jobId) => {
        const job = byId.get(jobId);
        return {
          jobId,
          type: job?.type ?? 'unknown',
          label: job?.label ?? null,
          completedAt: job?.gdriveSyncedAt?.toISOString() ?? job?.completedAt?.toISOString() ?? null,
          reasons: protectedMap.get(jobId) ?? [],
        };
      })
      .sort((a, b) => a.jobId.localeCompare(b.jobId));
  }

  private retentionBucket(job: JobWithSchedule): RetentionBucket | null {
    if (job.type === BackupJobType.manual || job.type === BackupJobType.upload) return 'daily';

    if (job.type === BackupJobType.scheduled && job.backupSchedule) {
      switch (job.backupSchedule.frequency) {
        case BackupScheduleFrequency.daily:
          return 'daily';
        case BackupScheduleFrequency.weekly:
          return 'weekly';
        case BackupScheduleFrequency.monthly:
          return 'monthly';
        default:
          return 'daily';
      }
    }

    if (job.type === BackupJobType.scheduled) return 'daily';
    return null;
  }

  private async deleteDriveCopy(job: JobWithSchedule, principal: AuthPrincipal): Promise<void> {
    const refreshToken = await this.integration.getRefreshToken();
    if (!refreshToken || !job.gdriveFileId) return;

    await this.drive.deleteFile(refreshToken, job.gdriveFileId);

    if (job.storagePolicy === BackupStoragePolicy.drive_only) {
      await this.prisma.backupJob.delete({ where: { id: job.id } });
      await this.audit.log(
        this.audit.fromPrincipal(principal, {
          action: 'backup.drive.deleted',
          resourceType: 'backup_job',
          resourceId: job.id,
          previousState: {
            gdriveFileId: job.gdriveFileId,
            storagePolicy: job.storagePolicy,
          },
          newState: {
            message: `Drive retention deleted drive_only backup ${job.id}`,
            jobDeleted: true,
          },
        }),
      );
      return;
    }

    await this.prisma.backupJob.update({
      where: { id: job.id },
      data: {
        gdriveFileId: null,
        gdriveSyncedAt: null,
        gdriveSyncStatus: null,
        gdriveSyncError: null,
        gdriveSyncAttempts: 0,
        gdriveNextRetryAt: null,
        storageDestination: BackupStorageDestination.local,
      },
    });

    await this.audit.log(
      this.audit.fromPrincipal(principal, {
        action: 'backup.drive.deleted',
        resourceType: 'backup_job',
        resourceId: job.id,
        previousState: {
          gdriveFileId: job.gdriveFileId,
          storagePolicy: job.storagePolicy,
        },
        newState: {
          message: `Drive retention removed Drive copy for backup ${job.id}; local copy retained`,
          jobDeleted: false,
        },
      }),
    );
  }
}
