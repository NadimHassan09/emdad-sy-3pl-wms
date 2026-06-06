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
var BackupRetentionService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackupRetentionService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const audit_log_service_1 = require("../../common/audit/audit-log.service");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const backup_bootstrap_constants_1 = require("./backup-bootstrap.constants");
const backup_config_1 = require("./backup-config");
const backup_operations_service_1 = require("./backup-operations.service");
const backup_storage_service_1 = require("./backup-storage.service");
const RETENTION_ELIGIBLE_TYPES = [
    client_1.BackupJobType.manual,
    client_1.BackupJobType.scheduled,
    client_1.BackupJobType.upload,
    client_1.BackupJobType.pre_snapshot,
];
let BackupRetentionService = BackupRetentionService_1 = class BackupRetentionService {
    prisma;
    backupConfig;
    storage;
    operations;
    audit;
    logger = new common_1.Logger(BackupRetentionService_1.name);
    constructor(prisma, backupConfig, storage, operations, audit) {
        this.prisma = prisma;
        this.backupConfig = backupConfig;
        this.storage = storage;
        this.operations = operations;
        this.audit = audit;
    }
    getPolicies() {
        return {
            keepLastDaily: this.backupConfig.keepLastDaily,
            keepLastWeekly: this.backupConfig.keepLastWeekly,
            keepLastMonthly: this.backupConfig.keepLastMonthly,
            preSnapshotProtectDays: this.backupConfig.preSnapshotProtectDays,
            retentionCleanupEnabled: this.backupConfig.retentionCleanupEnabled,
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
            throw new Error('Retention cleanup requires an authenticated principal.');
        }
        const now = new Date();
        const policies = this.getPolicies();
        const jobs = await this.prisma.backupJob.findMany({
            where: {
                status: client_1.BackupJobStatus.completed,
                type: { in: RETENTION_ELIGIBLE_TYPES },
                localArtifactPurged: false,
            },
            include: { backupSchedule: true },
            orderBy: [{ completedAt: 'desc' }, { createdAt: 'desc' }],
        });
        const protectedMap = await this.buildProtectedSet(jobs, now);
        const buckets = this.buildBucketSummaries(jobs, protectedMap);
        const deleteCandidates = new Set();
        for (const bucket of buckets) {
            for (const id of bucket.expiredJobIds) {
                if (!protectedMap.has(id))
                    deleteCandidates.add(id);
            }
        }
        const protectedSummaries = await this.summarizeProtected(protectedMap);
        let bytesReclaimed = 0;
        const deletedJobIds = [];
        for (const jobId of [...deleteCandidates].sort()) {
            if (opts.dryRun) {
                bytesReclaimed += await this.storage.jobArtifactBytes(jobId);
                deletedJobIds.push(jobId);
                continue;
            }
            const reclaimed = await this.deleteBackup(jobId, opts.principal);
            bytesReclaimed += reclaimed;
            deletedJobIds.push(jobId);
        }
        if (!opts.dryRun && opts.principal) {
            await this.audit.log(this.audit.fromPrincipal(opts.principal, {
                action: 'backup.retention.cleanup',
                resourceType: 'backup_retention',
                resourceId: backup_bootstrap_constants_1.RETENTION_CLEANUP_RESOURCE_ID,
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
            }));
        }
        if (!opts.dryRun && deletedJobIds.length > 0) {
            this.logger.log(`Retention cleanup removed ${deletedJobIds.length} backup(s), reclaimed ${bytesReclaimed} bytes`);
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
    buildBucketSummaries(jobs, protectedMap) {
        const bucketDefs = [
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
    async buildProtectedSet(completedJobs, now) {
        const protectedMap = new Map();
        const add = (id, reason) => {
            const existing = protectedMap.get(id) ?? [];
            if (!existing.includes(reason))
                existing.push(reason);
            protectedMap.set(id, existing);
        };
        const latest = completedJobs.find((j) => this.hasRestorableArtifact(j));
        if (latest)
            add(latest.id, 'latest_successful');
        const preSnapshotCutoff = new Date(now.getTime() - this.backupConfig.preSnapshotProtectDays * 86_400_000);
        for (const job of completedJobs) {
            if (job.type !== client_1.BackupJobType.pre_snapshot)
                continue;
            const completedAt = job.completedAt ?? job.createdAt;
            if (completedAt >= preSnapshotCutoff) {
                add(job.id, 'pre_snapshot_age');
            }
        }
        const activeJobs = await this.prisma.backupJob.findMany({
            where: { status: { in: [client_1.BackupJobStatus.pending, client_1.BackupJobStatus.running] } },
            select: { id: true, parentJobId: true, type: true, manifest: true },
        });
        const activeIds = activeJobs.map((j) => j.id);
        if (activeIds.length > 0) {
            const children = await this.prisma.backupJob.findMany({
                where: { parentJobId: { in: activeIds } },
                select: { id: true },
            });
            for (const child of children)
                add(child.id, 'active_operation');
        }
        const memActive = this.operations.getActiveJobId();
        if (memActive)
            add(memActive, 'active_operation');
        for (const job of activeJobs) {
            add(job.id, 'active_operation');
            if (job.parentJobId)
                add(job.parentJobId, 'active_operation');
            if (job.type === client_1.BackupJobType.restore) {
                const manifest = job.manifest;
                if (manifest?.sourceBackupId)
                    add(manifest.sourceBackupId, 'active_operation');
                if (manifest?.preSnapshotId)
                    add(manifest.preSnapshotId, 'active_operation');
            }
        }
        return protectedMap;
    }
    async summarizeProtected(protectedMap) {
        const ids = [...protectedMap.keys()];
        if (ids.length === 0)
            return [];
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
    retentionBucket(job) {
        if (job.type === client_1.BackupJobType.pre_snapshot)
            return null;
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
        if (job.type === client_1.BackupJobType.manual || job.type === client_1.BackupJobType.upload) {
            return 'daily';
        }
        if (job.type === client_1.BackupJobType.scheduled)
            return 'daily';
        return null;
    }
    hasRestorableArtifact(job) {
        if (job.localArtifactPurged)
            return false;
        if (job.bytesWritten > 0n)
            return true;
        if (job.dumpFilename || job.artifactPath)
            return true;
        return false;
    }
    async deleteBackup(jobId, principal) {
        const job = await this.prisma.backupJob.findUnique({ where: { id: jobId } });
        if (!job)
            return 0;
        const bytesReclaimed = await this.storage.removeJobDirectory(jobId);
        await this.prisma.backupJob.delete({ where: { id: jobId } });
        await this.audit.log(this.audit.fromPrincipal(principal, {
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
        }));
        return bytesReclaimed;
    }
};
exports.BackupRetentionService = BackupRetentionService;
exports.BackupRetentionService = BackupRetentionService = BackupRetentionService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        backup_config_1.BackupConfig,
        backup_storage_service_1.BackupStorageService,
        backup_operations_service_1.BackupOperationsService,
        audit_log_service_1.AuditLogService])
], BackupRetentionService);
//# sourceMappingURL=backup-retention.service.js.map