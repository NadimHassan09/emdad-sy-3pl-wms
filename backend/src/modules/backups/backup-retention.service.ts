import { Injectable, Logger } from '@nestjs/common';
import {
  BackupJob,
  BackupJobStatus,
  BackupJobType,
  BackupSchedule,
  BackupScheduleFrequency,
} from '@prisma/client';

import { AuditLogService } from '../../common/audit/audit-log.service';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RETENTION_CLEANUP_RESOURCE_ID } from './backup-bootstrap.constants';
import { BackupConfig } from './backup-config';
import { BackupOperationsService } from './backup-operations.service';
import { BackupStorageService } from './backup-storage.service';
import {
  ProtectedBackupSummary,
  RetentionBucket,
  RetentionBucketSummary,
  RetentionCleanupResult,
  RetentionProtectionReason,
} from './backup-retention.types';

type JobWithSchedule = BackupJob & { backupSchedule: BackupSchedule | null };

type RestoreManifest = {
  sourceBackupId?: string;
  preSnapshotId?: string;
};

const RETENTION_ELIGIBLE_TYPES: BackupJobType[] = [
  BackupJobType.manual,
  BackupJobType.scheduled,
  BackupJobType.upload,
  BackupJobType.pre_snapshot,
];

@Injectable()
export class BackupRetentionService {
  private readonly logger = new Logger(BackupRetentionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly backupConfig: BackupConfig,
    private readonly storage: BackupStorageService,
    private readonly operations: BackupOperationsService,
    private readonly audit: AuditLogService,
  ) {}

  getPolicies() {
    return {
      keepLastDaily: this.backupConfig.keepLastDaily,
      keepLastWeekly: this.backupConfig.keepLastWeekly,
      keepLastMonthly: this.backupConfig.keepLastMonthly,
      preSnapshotProtectDays: this.backupConfig.preSnapshotProtectDays,
      retentionCleanupEnabled: this.backupConfig.retentionCleanupEnabled,
    };
  }

  async previewCleanup(): Promise<RetentionCleanupResult> {
    return this.runCleanup({ dryRun: true, principal: null });
  }

  async executeCleanup(principal: AuthPrincipal): Promise<RetentionCleanupResult> {
    return this.runCleanup({ dryRun: false, principal });
  }

  private async runCleanup(opts: {
    dryRun: boolean;
    principal: AuthPrincipal | null;
  }): Promise<RetentionCleanupResult> {
    if (!opts.dryRun && !opts.principal) {
      throw new Error('Retention cleanup requires an authenticated principal.');
    }
    const now = new Date();
    const policies = this.getPolicies();

    const jobs = await this.prisma.backupJob.findMany({
      where: {
        status: BackupJobStatus.completed,
        type: { in: RETENTION_ELIGIBLE_TYPES },
        localArtifactPurged: false,
      },
      include: { backupSchedule: true },
      orderBy: [{ completedAt: 'desc' }, { createdAt: 'desc' }],
    });

    const protectedMap = await this.buildProtectedSet(jobs, now);
    const buckets = this.buildBucketSummaries(jobs, protectedMap);

    const deleteCandidates = new Set<string>();
    for (const bucket of buckets) {
      for (const id of bucket.expiredJobIds) {
        if (!protectedMap.has(id)) deleteCandidates.add(id);
      }
    }

    const protectedSummaries = await this.summarizeProtected(protectedMap);
    let bytesReclaimed = 0;
    const deletedJobIds: string[] = [];

    for (const jobId of [...deleteCandidates].sort()) {
      if (opts.dryRun) {
        bytesReclaimed += await this.storage.jobArtifactBytes(jobId);
        deletedJobIds.push(jobId);
        continue;
      }

      const reclaimed = await this.deleteBackup(jobId, opts.principal!);
      bytesReclaimed += reclaimed;
      deletedJobIds.push(jobId);
    }

    if (!opts.dryRun && opts.principal) {
      await this.audit.log(
        this.audit.fromPrincipal(opts.principal, {
          action: 'backup.retention.cleanup',
          resourceType: 'backup_retention',
          resourceId: RETENTION_CLEANUP_RESOURCE_ID,
          newState: {
            message: `${opts.principal.email ?? opts.principal.id} ran backup retention cleanup`,
            deletedCount: deletedJobIds.length,
            bytesReclaimed,
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

    if (!opts.dryRun && deletedJobIds.length > 0) {
      this.logger.log(
        `Retention cleanup removed ${deletedJobIds.length} backup(s), reclaimed ${bytesReclaimed} bytes`,
      );
    }

    return {
      dryRun: opts.dryRun,
      policies: {
        keepLastDaily: policies.keepLastDaily,
        keepLastWeekly: policies.keepLastWeekly,
        keepLastMonthly: policies.keepLastMonthly,
        preSnapshotProtectDays: policies.preSnapshotProtectDays,
      },
      buckets,
      protected: protectedSummaries,
      deletedCount: deletedJobIds.length,
      bytesReclaimed,
      deletedJobIds,
    };
  }

  private buildBucketSummaries(
    jobs: JobWithSchedule[],
    protectedMap: Map<string, RetentionProtectionReason[]>,
  ): RetentionBucketSummary[] {
    const bucketDefs: { bucket: RetentionBucket; keepLast: number }[] = [
      { bucket: 'daily', keepLast: this.backupConfig.keepLastDaily },
      { bucket: 'weekly', keepLast: this.backupConfig.keepLastWeekly },
      { bucket: 'monthly', keepLast: this.backupConfig.keepLastMonthly },
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
    completedJobs: JobWithSchedule[],
    now: Date,
  ): Promise<Map<string, RetentionProtectionReason[]>> {
    const protectedMap = new Map<string, RetentionProtectionReason[]>();

    const add = (id: string, reason: RetentionProtectionReason) => {
      const existing = protectedMap.get(id) ?? [];
      if (!existing.includes(reason)) existing.push(reason);
      protectedMap.set(id, existing);
    };

    const latest = completedJobs.find((j) => this.hasRestorableArtifact(j));
    if (latest) add(latest.id, 'latest_successful');

    const preSnapshotCutoff = new Date(
      now.getTime() - this.backupConfig.preSnapshotProtectDays * 86_400_000,
    );
    for (const job of completedJobs) {
      if (job.type !== BackupJobType.pre_snapshot) continue;
      const completedAt = job.completedAt ?? job.createdAt;
      if (completedAt >= preSnapshotCutoff) {
        add(job.id, 'pre_snapshot_age');
      }
    }

    const activeJobs = await this.prisma.backupJob.findMany({
      where: { status: { in: [BackupJobStatus.pending, BackupJobStatus.running] } },
      select: { id: true, parentJobId: true, type: true, manifest: true },
    });

    const activeIds = activeJobs.map((j) => j.id);
    if (activeIds.length > 0) {
      const children = await this.prisma.backupJob.findMany({
        where: { parentJobId: { in: activeIds } },
        select: { id: true },
      });
      for (const child of children) add(child.id, 'active_operation');
    }

    const memActive = this.operations.getActiveJobId();
    if (memActive) add(memActive, 'active_operation');

    for (const job of activeJobs) {
      add(job.id, 'active_operation');
      if (job.parentJobId) add(job.parentJobId, 'active_operation');

      if (job.type === BackupJobType.restore) {
        const manifest = job.manifest as RestoreManifest | null;
        if (manifest?.sourceBackupId) add(manifest.sourceBackupId, 'active_operation');
        if (manifest?.preSnapshotId) add(manifest.preSnapshotId, 'active_operation');
      }
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
      select: { id: true, type: true, label: true, completedAt: true },
    });
    const byId = new Map(rows.map((j) => [j.id, j]));

    return ids
      .map((jobId) => {
        const job = byId.get(jobId);
        return {
          jobId,
          type: job?.type ?? 'unknown',
          label: job?.label ?? null,
          completedAt: job?.completedAt?.toISOString() ?? null,
          reasons: protectedMap.get(jobId) ?? [],
        };
      })
      .sort((a, b) => a.jobId.localeCompare(b.jobId));
  }

  retentionBucket(job: JobWithSchedule): RetentionBucket | null {
    if (job.type === BackupJobType.pre_snapshot) return null;

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

    if (job.type === BackupJobType.manual || job.type === BackupJobType.upload) {
      return 'daily';
    }

    if (job.type === BackupJobType.scheduled) return 'daily';

    return null;
  }

  private hasRestorableArtifact(job: BackupJob): boolean {
    if (job.localArtifactPurged) return false;
    if (job.bytesWritten > 0n) return true;
    if (job.dumpFilename || job.artifactPath) return true;
    return false;
  }

  private async deleteBackup(jobId: string, principal: AuthPrincipal): Promise<number> {
    const job = await this.prisma.backupJob.findUnique({ where: { id: jobId } });
    if (!job) return 0;

    const bytesReclaimed = await this.storage.removeJobDirectory(jobId);

    await this.prisma.backupJob.delete({ where: { id: jobId } });

    await this.audit.log(
      this.audit.fromPrincipal(principal, {
        action: 'backup.deleted',
        resourceType: 'backup_job',
        resourceId: jobId,
        previousState: {
          type: job.type,
          label: job.label,
          status: job.status,
          completedAt: job.completedAt?.toISOString() ?? null,
          bytesWritten: job.bytesWritten.toString(),
        },
        newState: {
          message: `Retention cleanup deleted backup ${jobId}`,
          bytesReclaimed,
        },
      }),
    );

    return bytesReclaimed;
  }
}
