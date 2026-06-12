import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { UserRole } from '@prisma/client';

import { AuditLogService } from '../../common/audit/audit-log.service';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { CronLeaderService } from '../../common/cron/cron-leader.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BACKUP_HEALTH_RESOURCE_ID } from './backup-bootstrap.constants';
import { BackupConfig } from './backup-config';
import { BackupHealthAlert, BackupHealthSeverity } from './backup-health.types';
import { BackupHealthService } from './backup-health.service';

type AlertState = {
  severity: BackupHealthSeverity;
  lastEmittedAt: number;
};

@Injectable()
export class BackupHealthAlertService {
  private readonly logger = new Logger(BackupHealthAlertService.name);
  private readonly emitted = new Map<string, AlertState>();
  private systemPrincipal: AuthPrincipal | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly backupConfig: BackupConfig,
    private readonly health: BackupHealthService,
    private readonly audit: AuditLogService,
    private readonly cronLeader: CronLeaderService,
  ) {}

  /** Evaluate backup health every 15 minutes and emit deduplicated audit alerts. */
  @Cron('*/15 * * * *')
  async evaluateAndAlert(): Promise<void> {
    await this.cronLeader.runExclusive('backup-health-alert', 960, () =>
      this.runEvaluateAndAlert(),
    );
  }

  private async runEvaluateAndAlert(): Promise<void> {
    if (!this.backupConfig.enabled || !this.backupConfig.healthMonitoringEnabled) {
      return;
    }

    const snapshot = await this.health.getHealth();
    const principal = await this.resolveSystemPrincipal();
    if (!principal) {
      this.logger.warn('Skipping backup health alerts — no active super_admin system user.');
      return;
    }

    if (snapshot.healthStatus === 'healthy') {
      this.emitted.clear();
      return;
    }

    const cooldownMs = this.backupConfig.healthAlertCooldownHours * 3_600_000;
    const now = Date.now();

    for (const alert of snapshot.alerts) {
      const key = `${alert.code}:${alert.severity}`;
      const previous = this.emitted.get(key);
      const shouldEmit =
        !previous ||
        (alert.severity === 'critical' && previous.severity !== 'critical') ||
        now - previous.lastEmittedAt >= cooldownMs;

      if (!shouldEmit) continue;

      const action =
        alert.severity === 'critical' ? 'backup.health.critical' : 'backup.health.warning';

      await this.audit.logBestEffort(
        this.audit.fromPrincipal(principal, {
          action,
          resourceType: 'backup_health',
          resourceId: BACKUP_HEALTH_RESOURCE_ID,
          newState: {
            message: alert.message,
            code: alert.code,
            severity: alert.severity,
            healthStatus: snapshot.healthStatus,
            metrics: snapshot.metrics,
          },
        }),
      );

      this.emitted.set(key, { severity: alert.severity, lastEmittedAt: now });
      this.logger.warn(`Backup health ${alert.severity}: ${alert.message}`);
    }
  }

  /** Used by verification to force an immediate alert evaluation. */
  async evaluateNow(): Promise<{ healthStatus: BackupHealthSeverity; alerts: BackupHealthAlert[] }> {
    await this.evaluateAndAlert();
    const snapshot = await this.health.getHealth();
    return { healthStatus: snapshot.healthStatus, alerts: snapshot.alerts };
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
