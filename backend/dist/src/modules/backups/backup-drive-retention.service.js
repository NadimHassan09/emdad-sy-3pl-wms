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
var BackupDriveRetentionService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackupDriveRetentionService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const audit_log_service_1 = require("../../common/audit/audit-log.service");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const backup_bootstrap_constants_1 = require("./backup-bootstrap.constants");
const backup_config_1 = require("./backup-config");
const backup_drive_integration_service_1 = require("./backup-drive-integration.service");
const backup_drive_service_1 = require("./backup-drive.service");
const backup_operations_service_1 = require("./backup-operations.service");
const DRIVE_RETENTION_ELIGIBLE_TYPES = [
    client_1.BackupJobType.manual,
    client_1.BackupJobType.scheduled,
    client_1.BackupJobType.upload,
];
let BackupDriveRetentionService = BackupDriveRetentionService_1 = class BackupDriveRetentionService {
    prisma;
    backupConfig;
    integration;
    drive;
    operations;
    audit;
    logger = new common_1.Logger(BackupDriveRetentionService_1.name);
    constructor(prisma, backupConfig, integration, drive, operations, audit) {
        this.prisma = prisma;
        this.backupConfig = backupConfig;
        this.integration = integration;
        this.drive = drive;
        this.operations = operations;
        this.audit = audit;
    }
    getPolicies() {
        return {
            keepLastDaily: this.backupConfig.gdriveKeepLastDaily,
            keepLastWeekly: this.backupConfig.gdriveKeepLastWeekly,
            keepLastMonthly: this.backupConfig.gdriveKeepLastMonthly,
            driveRetentionCleanupEnabled: this.backupConfig.gdriveRetentionCleanupEnabled,
        };
    }
    async previewCleanup() {
        return this.runCleanup({ dryRun: true, principal: null });
    }
    async executeCleanup(principal) {
        return this.runCleanup({ dryRun: false, principal });
    }
    async runCleanup(opts) {
        if (!opts.dryRun && !opts.principal) {
            throw new Error('Drive retention cleanup requires an authenticated principal.');
        }
        const policies = this.getPolicies();
        const jobs = await this.prisma.backupJob.findMany({
            where: {
                status: client_1.BackupJobStatus.completed,
                gdriveSyncStatus: client_1.BackupDriveSyncStatus.synced,
                gdriveFileId: { not: null },
                type: { in: DRIVE_RETENTION_ELIGIBLE_TYPES },
            },
            include: { backupSchedule: true },
            orderBy: [{ gdriveSyncedAt: 'desc' }, { completedAt: 'desc' }],
        });
        const protectedMap = await this.buildProtectedSet(jobs);
        const buckets = this.buildBucketSummaries(jobs, protectedMap);
        const deleteCandidates = new Set();
        for (const bucket of buckets) {
            for (const id of bucket.expiredJobIds) {
                if (!protectedMap.has(id))
                    deleteCandidates.add(id);
            }
        }
        const protectedSummaries = await this.summarizeProtected(protectedMap);
        const deletedDriveJobIds = [];
        const deletedJobIds = [];
        for (const jobId of [...deleteCandidates].sort()) {
            const job = jobs.find((j) => j.id === jobId);
            if (!job?.gdriveFileId)
                continue;
            if (opts.dryRun) {
                deletedDriveJobIds.push(jobId);
                if (job.storagePolicy === client_1.BackupStoragePolicy.drive_only)
                    deletedJobIds.push(jobId);
                continue;
            }
            await this.deleteDriveCopy(job, opts.principal);
            deletedDriveJobIds.push(jobId);
            if (job.storagePolicy === client_1.BackupStoragePolicy.drive_only)
                deletedJobIds.push(jobId);
        }
        if (!opts.dryRun && opts.principal) {
            await this.audit.log(this.audit.fromPrincipal(opts.principal, {
                action: 'backup.drive.retention.cleanup',
                resourceType: 'backup_drive_retention',
                resourceId: backup_bootstrap_constants_1.DRIVE_RETENTION_CLEANUP_RESOURCE_ID,
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
            }));
        }
        if (!opts.dryRun && deletedDriveJobIds.length > 0) {
            this.logger.log(`Drive retention removed ${deletedDriveJobIds.length} Drive copy/copies (${deletedJobIds.length} job rows deleted)`);
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
    buildBucketSummaries(jobs, protectedMap) {
        const bucketDefs = [
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
    async buildProtectedSet(jobs) {
        const protectedMap = new Map();
        const add = (id, reason) => {
            const existing = protectedMap.get(id) ?? [];
            if (!existing.includes(reason))
                existing.push(reason);
            protectedMap.set(id, existing);
        };
        const latest = jobs[0];
        if (latest)
            add(latest.id, 'latest_successful');
        const activeJobs = await this.prisma.backupJob.findMany({
            where: { status: { in: [client_1.BackupJobStatus.pending, client_1.BackupJobStatus.running] } },
            select: { id: true, parentJobId: true, type: true, manifest: true },
        });
        const memActive = this.operations.getActiveJobId();
        if (memActive)
            add(memActive, 'active_operation');
        for (const job of activeJobs) {
            add(job.id, 'active_operation');
            if (job.parentJobId)
                add(job.parentJobId, 'active_operation');
        }
        return protectedMap;
    }
    async summarizeProtected(protectedMap) {
        const ids = [...protectedMap.keys()];
        if (ids.length === 0)
            return [];
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
    retentionBucket(job) {
        if (job.type === client_1.BackupJobType.manual || job.type === client_1.BackupJobType.upload)
            return 'daily';
        if (job.type === client_1.BackupJobType.scheduled && job.backupSchedule) {
            switch (job.backupSchedule.frequency) {
                case client_1.BackupScheduleFrequency.daily:
                    return 'daily';
                case client_1.BackupScheduleFrequency.weekly:
                    return 'weekly';
                case client_1.BackupScheduleFrequency.monthly:
                    return 'monthly';
                default:
                    return 'daily';
            }
        }
        if (job.type === client_1.BackupJobType.scheduled)
            return 'daily';
        return null;
    }
    async deleteDriveCopy(job, principal) {
        const refreshToken = await this.integration.getRefreshToken();
        if (!refreshToken || !job.gdriveFileId)
            return;
        await this.drive.deleteFile(refreshToken, job.gdriveFileId);
        if (job.storagePolicy === client_1.BackupStoragePolicy.drive_only) {
            await this.prisma.backupJob.delete({ where: { id: job.id } });
            await this.audit.log(this.audit.fromPrincipal(principal, {
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
            }));
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
                storageDestination: client_1.BackupStorageDestination.local,
            },
        });
        await this.audit.log(this.audit.fromPrincipal(principal, {
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
        }));
    }
};
exports.BackupDriveRetentionService = BackupDriveRetentionService;
exports.BackupDriveRetentionService = BackupDriveRetentionService = BackupDriveRetentionService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        backup_config_1.BackupConfig,
        backup_drive_integration_service_1.BackupDriveIntegrationService,
        backup_drive_service_1.BackupDriveService,
        backup_operations_service_1.BackupOperationsService,
        audit_log_service_1.AuditLogService])
], BackupDriveRetentionService);
//# sourceMappingURL=backup-drive-retention.service.js.map