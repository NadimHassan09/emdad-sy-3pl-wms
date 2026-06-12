"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackupHealthService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const backup_config_1 = require("./backup-config");
const backup_drive_integration_service_1 = require("./backup-drive-integration.service");
const backup_maintenance_service_1 = require("./backup-maintenance.service");
const backup_operations_service_1 = require("./backup-operations.service");
const backup_retention_service_1 = require("./backup-retention.service");
const backup_schedule_util_1 = require("./backup-schedule.util");
const backup_storage_service_1 = require("./backup-storage.service");
const SUCCESSFUL_BACKUP_TYPES = [
    client_1.BackupJobType.manual,
    client_1.BackupJobType.scheduled,
    client_1.BackupJobType.upload,
];
const FAILURE_BACKUP_TYPES = [
    client_1.BackupJobType.manual,
    client_1.BackupJobType.scheduled,
    client_1.BackupJobType.upload,
    client_1.BackupJobType.pre_snapshot,
    client_1.BackupJobType.factory_reset,
];
let BackupHealthService = class BackupHealthService {
    prisma;
    backupConfig;
    storage;
    operations;
    maintenance;
    retention;
    driveIntegration;
    constructor(prisma, backupConfig, storage, operations, maintenance, retention, driveIntegration) {
        this.prisma = prisma;
        this.backupConfig = backupConfig;
        this.storage = storage;
        this.operations = operations;
        this.maintenance = maintenance;
        this.retention = retention;
        this.driveIntegration = driveIntegration;
    }
    async getHealth() {
        const now = new Date();
        const [lastSuccess, lastFailure, backupCount, oldestBackup, recentFailureCount, storageUsedBytes, schedules, retentionPreview, lastCleanup, runningJob,] = await Promise.all([
            this.prisma.backupJob.findFirst({
                where: {
                    status: client_1.BackupJobStatus.completed,
                    type: { in: SUCCESSFUL_BACKUP_TYPES },
                    bytesWritten: { gt: 0 },
                },
                orderBy: [{ completedAt: 'desc' }, { createdAt: 'desc' }],
                select: { completedAt: true, createdAt: true },
            }),
            this.prisma.backupJob.findFirst({
                where: {
                    status: client_1.BackupJobStatus.failed,
                    type: { in: FAILURE_BACKUP_TYPES },
                },
                orderBy: [{ completedAt: 'desc' }, { createdAt: 'desc' }],
                select: { completedAt: true, createdAt: true },
            }),
            this.prisma.backupJob.count({
                where: {
                    status: client_1.BackupJobStatus.completed,
                    type: { in: SUCCESSFUL_BACKUP_TYPES },
                    bytesWritten: { gt: 0 },
                },
            }),
            this.prisma.backupJob.findFirst({
                where: {
                    status: client_1.BackupJobStatus.completed,
                    type: { in: SUCCESSFUL_BACKUP_TYPES },
                    bytesWritten: { gt: 0 },
                },
                orderBy: [{ completedAt: 'asc' }, { createdAt: 'asc' }],
                select: { completedAt: true, createdAt: true },
            }),
            this.prisma.backupJob.count({
                where: {
                    status: client_1.BackupJobStatus.failed,
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
        const retentionStatus = {
            policies: {
                keepLastDaily: this.backupConfig.keepLastDaily,
                keepLastWeekly: this.backupConfig.keepLastWeekly,
                keepLastMonthly: this.backupConfig.keepLastMonthly,
                preSnapshotProtectDays: this.backupConfig.preSnapshotProtectDays,
                retentionCleanupEnabled: this.backupConfig.retentionCleanupEnabled,
            },
            eligibleCompletedCount: retentionPreview.buckets.reduce((n, b) => n + b.totalEligible, 0),
            pendingDeletionCount: retentionPreview.deletedCount,
            lastCleanupAt: lastCleanup?.createdAt.toISOString() ?? null,
            lastCleanupDeletedCount: this.readDeletedCount(lastCleanup?.newState),
        };
        const driveStatus = await this.buildDriveStatus(now);
        const alerts = this.evaluateAlerts({
            hoursSinceLastSuccessfulBackup,
            storageUsedBytes,
            recentFailureCount,
            driveStatus,
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
            driveStatus,
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
    async buildDriveStatus(now) {
        const admin = await this.driveIntegration.getAdminStatus();
        return {
            enabled: admin.gdriveEnabled,
            configured: admin.gdriveConfigured,
            connected: admin.connected,
            lastSyncedAt: admin.lastSyncedAt,
            pendingSyncCount: admin.pendingSyncCount,
            failedSyncCount: admin.failedSyncCount,
            hoursSinceLastSync: this.hoursSince(admin.lastSyncedAt, now),
        };
    }
    evaluateAlerts(input) {
        const alerts = [];
        const successHours = input.hoursSinceLastSuccessfulBackup;
        if (successHours === null || successHours > this.backupConfig.healthMaxSuccessAgeHours) {
            alerts.push({
                code: 'stale_successful_backup',
                severity: 'critical',
                message: successHours === null
                    ? 'No successful backup has been recorded.'
                    : `No successful backup in ${successHours.toFixed(1)}h (critical threshold ${this.backupConfig.healthMaxSuccessAgeHours}h).`,
            });
        }
        else if (successHours > this.backupConfig.healthWarnSuccessAgeHours) {
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
        }
        else if (input.storageUsedBytes >= this.backupConfig.healthStorageWarnBytes) {
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
        }
        else if (input.recentFailureCount >= this.backupConfig.healthFailureWarnCount) {
            alerts.push({
                code: 'repeated_failures',
                severity: 'warning',
                message: `${input.recentFailureCount} backup failure(s) in the last ${this.backupConfig.healthFailureWindowHours}h (warning threshold ${this.backupConfig.healthFailureWarnCount}).`,
            });
        }
        const drive = input.driveStatus;
        if (!drive.enabled) {
            return alerts;
        }
        if (!drive.configured) {
            alerts.push({
                code: 'gdrive_not_configured',
                severity: 'critical',
                message: 'Google Drive is enabled but OAuth credentials are missing (BACKUP_GDRIVE_CLIENT_ID/SECRET/REDIRECT_URI). Off-site DR is unavailable.',
            });
            return alerts;
        }
        if (!drive.connected) {
            alerts.push({
                code: 'gdrive_not_connected',
                severity: 'critical',
                message: 'Google Drive OAuth is configured but no account is connected. Connect Drive under Settings → Backups → Google Drive.',
            });
            return alerts;
        }
        if (drive.failedSyncCount > 0) {
            alerts.push({
                code: 'gdrive_sync_failures',
                severity: drive.failedSyncCount >= 3 ? 'critical' : 'warning',
                message: `${drive.failedSyncCount} backup(s) failed to sync to Google Drive. Review sync failures on the Google Drive settings page.`,
            });
        }
        if (drive.pendingSyncCount > 0) {
            alerts.push({
                code: 'gdrive_pending_sync',
                severity: 'warning',
                message: `${drive.pendingSyncCount} completed backup(s) are pending Google Drive upload.`,
            });
        }
        const syncHours = drive.hoursSinceLastSync;
        const staleThreshold = this.backupConfig.healthMaxSuccessAgeHours;
        if (syncHours !== null &&
            syncHours > staleThreshold &&
            this.backupConfig.defaultStoragePolicy !== 'local_only') {
            alerts.push({
                code: 'gdrive_stale_sync',
                severity: 'warning',
                message: `Last successful Google Drive sync was ${syncHours.toFixed(1)}h ago (threshold ${staleThreshold}h).`,
            });
        }
        return alerts;
    }
    resolveSeverity(alerts) {
        if (alerts.some((a) => a.severity === 'critical'))
            return 'critical';
        if (alerts.some((a) => a.severity === 'warning'))
            return 'warning';
        return 'healthy';
    }
    resolveNextScheduledBackupAt(schedules, now) {
        if (!this.backupConfig.schedulerEnabled)
            return null;
        const nextRuns = schedules
            .map((schedule) => (0, backup_schedule_util_1.getNextBackupScheduleRun)(schedule, now))
            .filter((value) => value !== null)
            .sort((a, b) => a.getTime() - b.getTime());
        return nextRuns[0]?.toISOString() ?? null;
    }
    async resolveRunningJob() {
        const activeJobId = this.operations.getActiveJobId();
        if (!activeJobId)
            return null;
        const job = await this.prisma.backupJob.findUnique({
            where: { id: activeJobId },
            select: { id: true, type: true, status: true, label: true },
        });
        return job;
    }
    hoursSince(iso, now) {
        if (!iso)
            return null;
        const ms = now.getTime() - new Date(iso).getTime();
        if (!Number.isFinite(ms) || ms < 0)
            return 0;
        return Math.round((ms / 3_600_000) * 10) / 10;
    }
    toIso(value) {
        return value ? value.toISOString() : null;
    }
    async findLastRetentionCleanup() {
        const rows = await this.prisma.$queryRaw(client_1.Prisma.sql `
      SELECT created_at, new_state
      FROM audit_logs
      WHERE action = 'backup.retention.cleanup'
      ORDER BY created_at DESC
      LIMIT 1
    `);
        const row = rows[0];
        if (!row)
            return null;
        return { createdAt: row.created_at, newState: row.new_state };
    }
    readDeletedCount(newState) {
        if (!newState || typeof newState !== 'object')
            return null;
        const raw = newState.deletedCount;
        return typeof raw === 'number' ? raw : typeof raw === 'string' ? Number.parseInt(raw, 10) : null;
    }
};
exports.BackupHealthService = BackupHealthService;
exports.BackupHealthService = BackupHealthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        backup_config_1.BackupConfig,
        backup_storage_service_1.BackupStorageService,
        backup_operations_service_1.BackupOperationsService,
        backup_maintenance_service_1.BackupMaintenanceService,
        backup_retention_service_1.BackupRetentionService,
        backup_drive_integration_service_1.BackupDriveIntegrationService])
], BackupHealthService);
//# sourceMappingURL=backup-health.service.js.map