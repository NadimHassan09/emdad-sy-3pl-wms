import { Injectable } from '@nestjs/common';
import {
  BackupJobStatus,
  BackupJobType,
  BackupSchedule,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { BackupConfig } from './backup-config';
import { BackupMaintenanceService } from './backup-maintenance.service';
import { BackupOperationsService } from './backup-operations.service';
import { BackupRetentionService } from './backup-retention.service';
import { getNextBackupScheduleRun } from './backup-schedule.util';
import { BackupStorageService } from './backup-storage.service';
import {
  BackupHealthAlert,
  BackupHealthResponse,
  BackupHealthSeverity,
  BackupRetentionStatus,
} from './backup-health.types';

const SUCCESSFUL_BACKUP_TYPES: BackupJobType[] = [
  BackupJobType.manual,
  BackupJobType.scheduled,
  BackupJobType.upload,
];

const FAILURE_BACKUP_TYPES: BackupJobType[] = [
  BackupJobType.manual,
  BackupJobType.scheduled,
  BackupJobType.upload,
  BackupJobType.pre_snapshot,
  BackupJobType.factory_reset,
];

@Injectable()
export class BackupHealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly backupConfig: BackupConfig,
    private readonly storage: BackupStorageService,
    private readonly operations: BackupOperationsService,
    private readonly maintenance: BackupMaintenanceService,
    private readonly retention: BackupRetentionService,
  ) {}

  async getHealth(): Promise<BackupHealthResponse> {
    const now = new Date();

    const [
      lastSuccess,
      lastFailure,
      backupCount,
      oldestBackup,
      recentFailureCount,
      storageUsedBytes,
      schedules,
      retentionPreview,
      lastCleanup,
      runningJob,
    ] = await Promise.all([
      this.prisma.backupJob.findFirst({
        where: {
          status: BackupJobStatus.completed,
          type: { in: SUCCESSFUL_BACKUP_TYPES },
          bytesWritten: { gt: 0 },
        },
        orderBy: [{ completedAt: 'desc' }, { createdAt: 'desc' }],
        select: { completedAt: true, createdAt: true },
      }),
      this.prisma.backupJob.findFirst({
        where: {
          status: BackupJobStatus.failed,
          type: { in: FAILURE_BACKUP_TYPES },
        },
        orderBy: [{ completedAt: 'desc' }, { createdAt: 'desc' }],
        select: { completedAt: true, createdAt: true },
      }),
      this.prisma.backupJob.count({
        where: {
          status: BackupJobStatus.completed,
          type: { in: SUCCESSFUL_BACKUP_TYPES },
          bytesWritten: { gt: 0 },
        },
      }),
      this.prisma.backupJob.findFirst({
        where: {
          status: BackupJobStatus.completed,
          type: { in: SUCCESSFUL_BACKUP_TYPES },
          bytesWritten: { gt: 0 },
        },
        orderBy: [{ completedAt: 'asc' }, { createdAt: 'asc' }],
        select: { completedAt: true, createdAt: true },
      }),
      this.prisma.backupJob.count({
        where: {
          status: BackupJobStatus.failed,
          type: { in: FAILURE_BACKUP_TYPES },
          createdAt: {
            gte: new Date(now.getTime() - this.backupConfig.healthFailureWindowHours * 3_600_000),
          },
        },
      }),
      this.storage.sumStorageBytes(),
      this.prisma.backupSchedule.findMany({ where: { enabled: true } }),
      this.retention.previewCleanup(),
      this.findLastRetentionCleanup(),
      this.resolveRunningJob(),
    ]);

    const lastSuccessfulBackupAt = this.toIso(lastSuccess?.completedAt ?? lastSuccess?.createdAt);
    const lastFailedBackupAt = this.toIso(lastFailure?.completedAt ?? lastFailure?.createdAt);
    const oldestAt = oldestBackup?.completedAt ?? oldestBackup?.createdAt ?? null;

    const hoursSinceLastSuccessfulBackup = this.hoursSince(lastSuccessfulBackupAt, now);
    const hoursSinceLastFailedBackup = this.hoursSince(lastFailedBackupAt, now);
    const oldestBackupAgeHours = this.hoursSince(this.toIso(oldestAt), now);

    const retentionStatus: BackupRetentionStatus = {
      policies: {
        keepLastDaily: this.backupConfig.keepLastDaily,
        keepLastWeekly: this.backupConfig.keepLastWeekly,
        keepLastMonthly: this.backupConfig.keepLastMonthly,
        preSnapshotProtectDays: this.backupConfig.preSnapshotProtectDays,
        retentionCleanupEnabled: this.backupConfig.retentionCleanupEnabled,
      },
      eligibleCompletedCount: retentionPreview.buckets.reduce(
        (n: number, b: { totalEligible: number }) => n + b.totalEligible,
        0,
      ),
      pendingDeletionCount: retentionPreview.deletedCount,
      lastCleanupAt: lastCleanup?.createdAt.toISOString() ?? null,
      lastCleanupDeletedCount: this.readDeletedCount(lastCleanup?.newState),
    };

    const alerts = this.evaluateAlerts({
      hoursSinceLastSuccessfulBackup,
      storageUsedBytes,
      recentFailureCount,
    });
    const healthStatus = this.resolveSeverity(alerts);

    return {
      lastSuccessfulBackupAt,
      lastFailedBackupAt,
      runningOperation: {
        busy: this.operations.isBusy(),
        activeJobId: this.operations.getActiveJobId(),
        maintenance: this.maintenance.isActive(),
        maintenanceReason: this.maintenance.getReason(),
        job: runningJob,
      },
      backupCount,
      storageUsedBytes,
      nextScheduledBackupAt: this.resolveNextScheduledBackupAt(schedules, now),
      retentionStatus,
      metrics: {
        hoursSinceLastSuccessfulBackup,
        hoursSinceLastFailedBackup,
        storageUsedBytes,
        oldestBackupAgeHours,
        recentFailureCount,
      },
      healthStatus,
      alerts,
    };
  }

  evaluateAlerts(input: {
    hoursSinceLastSuccessfulBackup: number | null;
    storageUsedBytes: number;
    recentFailureCount: number;
  }): BackupHealthAlert[] {
    const alerts: BackupHealthAlert[] = [];

    const successHours = input.hoursSinceLastSuccessfulBackup;
    if (successHours === null || successHours > this.backupConfig.healthMaxSuccessAgeHours) {
      alerts.push({
        code: 'stale_successful_backup',
        severity: 'critical',
        message:
          successHours === null
            ? 'No successful backup has been recorded.'
            : `No successful backup in ${successHours.toFixed(1)}h (critical threshold ${this.backupConfig.healthMaxSuccessAgeHours}h).`,
      });
    } else if (successHours > this.backupConfig.healthWarnSuccessAgeHours) {
      alerts.push({
        code: 'stale_successful_backup',
        severity: 'warning',
        message: `Last successful backup was ${successHours.toFixed(1)}h ago (warning threshold ${this.backupConfig.healthWarnSuccessAgeHours}h).`,
      });
    }

    if (input.storageUsedBytes >= this.backupConfig.healthStorageCriticalBytes) {
      alerts.push({
        code: 'storage_threshold',
        severity: 'critical',
        message: `Backup storage usage ${input.storageUsedBytes} bytes exceeds critical threshold ${this.backupConfig.healthStorageCriticalBytes} bytes.`,
      });
    } else if (input.storageUsedBytes >= this.backupConfig.healthStorageWarnBytes) {
      alerts.push({
        code: 'storage_threshold',
        severity: 'warning',
        message: `Backup storage usage ${input.storageUsedBytes} bytes exceeds warning threshold ${this.backupConfig.healthStorageWarnBytes} bytes.`,
      });
    }

    if (input.recentFailureCount >= this.backupConfig.healthFailureCriticalCount) {
      alerts.push({
        code: 'repeated_failures',
        severity: 'critical',
        message: `${input.recentFailureCount} backup failure(s) in the last ${this.backupConfig.healthFailureWindowHours}h (critical threshold ${this.backupConfig.healthFailureCriticalCount}).`,
      });
    } else if (input.recentFailureCount >= this.backupConfig.healthFailureWarnCount) {
      alerts.push({
        code: 'repeated_failures',
        severity: 'warning',
        message: `${input.recentFailureCount} backup failure(s) in the last ${this.backupConfig.healthFailureWindowHours}h (warning threshold ${this.backupConfig.healthFailureWarnCount}).`,
      });
    }

    return alerts;
  }

  private resolveSeverity(alerts: BackupHealthAlert[]): BackupHealthSeverity {
    if (alerts.some((a) => a.severity === 'critical')) return 'critical';
    if (alerts.some((a) => a.severity === 'warning')) return 'warning';
    return 'healthy';
  }

  private resolveNextScheduledBackupAt(schedules: BackupSchedule[], now: Date): string | null {
    if (!this.backupConfig.schedulerEnabled) return null;

    const nextRuns = schedules
      .map((schedule) => getNextBackupScheduleRun(schedule, now))
      .filter((value): value is Date => value !== null)
      .sort((a, b) => a.getTime() - b.getTime());

    return nextRuns[0]?.toISOString() ?? null;
  }

  private async resolveRunningJob() {
    const activeJobId = this.operations.getActiveJobId();
    if (!activeJobId) return null;

    const job = await this.prisma.backupJob.findUnique({
      where: { id: activeJobId },
      select: { id: true, type: true, status: true, label: true },
    });
    return job;
  }

  private hoursSince(iso: string | null, now: Date): number | null {
    if (!iso) return null;
    const ms = now.getTime() - new Date(iso).getTime();
    if (!Number.isFinite(ms) || ms < 0) return 0;
    return Math.round((ms / 3_600_000) * 10) / 10;
  }

  private toIso(value: Date | null | undefined): string | null {
    return value ? value.toISOString() : null;
  }

  private async findLastRetentionCleanup(): Promise<{
    createdAt: Date;
    newState: unknown;
  } | null> {
    const rows = await this.prisma.$queryRaw<
      Array<{ created_at: Date; new_state: unknown }>
    >(Prisma.sql`
      SELECT created_at, new_state
      FROM audit_logs
      WHERE action = 'backup.retention.cleanup'
      ORDER BY created_at DESC
      LIMIT 1
    `);
    const row = rows[0];
    if (!row) return null;
    return { createdAt: row.created_at, newState: row.new_state };
  }

  private readDeletedCount(newState: unknown): number | null {
    if (!newState || typeof newState !== 'object') return null;
    const raw = (newState as Record<string, unknown>).deletedCount;
    return typeof raw === 'number' ? raw : typeof raw === 'string' ? Number.parseInt(raw, 10) : null;
  }
}
