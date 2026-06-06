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
var BackupRunnerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackupRunnerService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const audit_log_service_1 = require("../../common/audit/audit-log.service");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const backup_config_1 = require("./backup-config");
const backup_drive_sync_service_1 = require("./backup-drive-sync.service");
const backup_storage_service_1 = require("./backup-storage.service");
const backup_operations_service_1 = require("./backup-operations.service");
const backup_pg_tools_service_1 = require("./backup-pg-tools.service");
let BackupRunnerService = BackupRunnerService_1 = class BackupRunnerService {
    prisma;
    backupConfig;
    storage;
    pg;
    operations;
    audit;
    driveSync;
    logger = new common_1.Logger(BackupRunnerService_1.name);
    constructor(prisma, backupConfig, storage, pg, operations, audit, driveSync) {
        this.prisma = prisma;
        this.backupConfig = backupConfig;
        this.storage = storage;
        this.pg = pg;
        this.operations = operations;
        this.audit = audit;
        this.driveSync = driveSync;
    }
    isBusy() {
        return this.operations.isBusy();
    }
    enqueueManual(jobId, user) {
        this.enqueue(jobId, user, client_1.BackupJobType.manual, { auditAction: 'backup.created' });
    }
    async runScheduledBackup(jobId, user, scheduleId) {
        if (!this.operations.tryAcquire(jobId)) {
            await this.markFailed(jobId, 'Another backup operation is already running.');
            throw new Error('Another backup operation is already running.');
        }
        try {
            await this.runBackup(jobId, user, client_1.BackupJobType.scheduled, {
                scheduleId,
                auditAction: 'backup.schedule.executed',
            });
        }
        finally {
            this.operations.release(jobId);
        }
    }
    enqueue(jobId, user, type, options) {
        if (!this.operations.tryAcquire(jobId)) {
            void this.markFailed(jobId, 'Another backup operation is already running.');
            return;
        }
        void this.runBackup(jobId, user, type, options).finally(() => {
            this.operations.release(jobId);
        });
    }
    async runBackup(jobId, user, type, options) {
        try {
            await this.storage.ensureJobDir(jobId);
            const artifactPath = this.storage.jobDirectory(jobId);
            const dumpFilename = `${jobId}.dump`;
            const dumpPath = this.storage.dumpPath(jobId);
            await this.prisma.backupJob.update({
                where: { id: jobId },
                data: {
                    status: client_1.BackupJobStatus.running,
                    startedAt: new Date(),
                    progressPercent: 5,
                    artifactPath,
                    dumpFilename,
                },
            });
            const dbName = this.pg.parseDbName(this.pg.getDatabaseUrl());
            const estimatedBytes = await this.pg.estimateDatabaseBytes(dbName);
            await this.pg.runPgDump(dumpPath, (bytes) => {
                const pct = this.estimateProgress(bytes, estimatedBytes);
                void this.updateProgress(jobId, pct, bytes).catch(() => undefined);
            }, estimatedBytes);
            const sizeBytes = await this.storage.fileSize(dumpPath);
            if (sizeBytes <= 0)
                throw new Error('pg_dump produced an empty file.');
            await this.updateProgress(jobId, 92, sizeBytes);
            const checksumSha256 = await this.storage.sha256File(dumpPath);
            const row = await this.prisma.backupJob.findUnique({
                where: { id: jobId },
                select: { label: true },
            });
            const manifest = {
                backupId: jobId,
                type,
                label: row?.label ?? null,
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
            await this.storage.writeManifest(jobId, manifest);
            await this.updateProgress(jobId, 98, sizeBytes);
            await this.prisma.backupJob.update({
                where: { id: jobId },
                data: {
                    status: client_1.BackupJobStatus.completed,
                    progressPercent: 100,
                    bytesWritten: BigInt(sizeBytes),
                    manifest: manifest,
                    completedAt: new Date(),
                    errorMessage: null,
                },
            });
            const auditAction = options.auditAction ?? 'backup.created';
            await this.audit.log(this.audit.fromPrincipal(user, {
                action: auditAction,
                resourceType: 'backup_job',
                resourceId: jobId,
                newState: {
                    message: `${user.email ?? user.id} completed ${type} backup ${jobId}`,
                    backupId: jobId,
                    scheduleId: options.scheduleId ?? null,
                    label: manifest.label,
                    sizeBytes,
                    checksumSha256,
                    dbName,
                    environmentId: manifest.environmentId,
                },
            }));
            this.logger.log(`Backup ${jobId} (${type}) completed (${sizeBytes} bytes)`);
            this.driveSync.enqueue(jobId, user);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error(`Backup ${jobId} (${type}) failed: ${message}`);
            await this.markFailed(jobId, message);
            await this.storage.removeJobArtifacts(jobId).catch(() => undefined);
            throw err;
        }
    }
    estimateProgress(bytesWritten, estimatedBytes) {
        if (estimatedBytes > 0 && bytesWritten > 0) {
            return Math.min(90, 5 + Math.floor((bytesWritten / estimatedBytes) * 85));
        }
        if (bytesWritten > 0)
            return Math.min(85, 10 + Math.floor(bytesWritten / 1_000_000) * 5);
        return 10;
    }
    async updateProgress(jobId, progressPercent, bytesWritten) {
        await this.prisma.backupJob.update({
            where: { id: jobId },
            data: {
                progressPercent: Math.max(0, Math.min(100, progressPercent)),
                bytesWritten: BigInt(Math.max(0, bytesWritten)),
            },
        });
    }
    async markFailed(jobId, errorMessage) {
        await this.prisma.backupJob.update({
            where: { id: jobId },
            data: {
                status: client_1.BackupJobStatus.failed,
                errorMessage,
                completedAt: new Date(),
            },
        });
    }
};
exports.BackupRunnerService = BackupRunnerService;
exports.BackupRunnerService = BackupRunnerService = BackupRunnerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        backup_config_1.BackupConfig,
        backup_storage_service_1.BackupStorageService,
        backup_pg_tools_service_1.BackupPgToolsService,
        backup_operations_service_1.BackupOperationsService,
        audit_log_service_1.AuditLogService,
        backup_drive_sync_service_1.BackupDriveSyncService])
], BackupRunnerService);
//# sourceMappingURL=backup-runner.service.js.map