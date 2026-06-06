import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BackupJobStatus, BackupJobType, UserRole } from '@prisma/client';

import { AuditLogService } from '../../common/audit/audit-log.service';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BackupConfig } from './backup-config';
import { BackupOperationsService } from './backup-operations.service';
import { BackupRunnerService } from './backup-runner.service';
import { isBackupScheduleDue } from './backup-schedule.util';
import { BackupStoragePolicyService } from './backup-storage-policy.service';

/**
 * In-process scheduled backup runner (BACKUP-4A).
 * Checks enabled schedules every minute; at most one scheduled backup per tick.
 */
@Injectable()
export class BackupSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(BackupSchedulerService.name);
  private systemPrincipal: AuthPrincipal | null = null;
  private scheduledRunInFlight = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly backupConfig: BackupConfig,
    private readonly operations: BackupOperationsService,
    private readonly runner: BackupRunnerService,
    private readonly audit: AuditLogService,
    private readonly storagePolicy: BackupStoragePolicyService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.resolveSystemPrincipal();
  }

  /** Every minute — match schedules by hour:minute in server local time. */
  @Cron('* * * * *')
  async tick(): Promise<void> {
    if (!this.backupConfig.enabled || !this.backupConfig.schedulerEnabled) {
      return;
    }

    if (this.scheduledRunInFlight) {
      return;
    }

    if (this.operations.isBusy() || this.runner.isBusy()) {
      this.logger.debug('Skipping scheduled backup tick — another operation is active.');
      return;
    }

    const runningScheduled = await this.prisma.backupJob.findFirst({
      where: {
        type: BackupJobType.scheduled,
        status: { in: [BackupJobStatus.pending, BackupJobStatus.running] },
      },
    });
    if (runningScheduled) {
      return;
    }

    const principal = await this.resolveSystemPrincipal();
    if (!principal) {
      this.logger.warn('Skipping scheduled backup — no active super_admin system user.');
      return;
    }

    const now = new Date();
    const schedules = await this.prisma.backupSchedule.findMany({
      where: { enabled: true },
      orderBy: { createdAt: 'asc' },
    });

    const due = schedules.filter((s) => isBackupScheduleDue(s, now));
    if (due.length === 0) return;

    const schedule = due[0];
    this.scheduledRunInFlight = true;

    try {
      await this.executeSchedule(schedule.id, principal);
    } catch (err) {
      this.logger.error(
        `Scheduled backup failed schedule=${schedule.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      this.scheduledRunInFlight = false;
    }

    if (due.length > 1) {
      this.logger.warn(
        `Skipped ${due.length - 1} additional due schedule(s) — only one scheduled backup at a time.`,
      );
    }
  }

  /** Manual trigger for verification (super_admin API). */
  async runScheduleNow(scheduleId: string, principal: AuthPrincipal): Promise<{ jobId: string }> {
    if (this.operations.isBusy() || this.runner.isBusy()) {
      throw new Error('Another backup operation is already running.');
    }
    if (this.scheduledRunInFlight) {
      throw new Error('A scheduled backup is already in progress.');
    }

    this.scheduledRunInFlight = true;
    try {
      return await this.executeSchedule(scheduleId, principal);
    } finally {
      this.scheduledRunInFlight = false;
    }
  }

  private async executeSchedule(
    scheduleId: string,
    principal: AuthPrincipal,
  ): Promise<{ jobId: string }> {
    const schedule = await this.prisma.backupSchedule.findUnique({ where: { id: scheduleId } });
    if (!schedule) throw new Error('Backup schedule not found.');

    const label = `scheduled:${schedule.frequency}@${String(schedule.hour).padStart(2, '0')}:${String(schedule.minute).padStart(2, '0')}`;
    const resolvedPolicy = await this.storagePolicy.resolveForSchedule(schedule.storagePolicy);

    const job = await this.prisma.backupJob.create({
      data: {
        type: BackupJobType.scheduled,
        status: BackupJobStatus.pending,
        label,
        triggeredByUserId: principal.id,
        backupScheduleId: scheduleId,
        storagePolicy: resolvedPolicy,
        progressPercent: 0,
      },
    });

    await this.prisma.backupSchedule.update({
      where: { id: scheduleId },
      data: { lastRunAt: new Date() },
    });

    try {
      await this.runner.runScheduledBackup(job.id, principal, scheduleId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.audit.logBestEffort(
        this.audit.fromPrincipal(principal, {
          action: 'backup.schedule.failed',
          resourceType: 'backup_schedule',
          resourceId: scheduleId,
          newState: {
            message: `Scheduled backup failed for schedule ${scheduleId}`,
            jobId: job.id,
            error: message,
          },
        }),
      );
      throw err;
    }

    return { jobId: job.id };
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
