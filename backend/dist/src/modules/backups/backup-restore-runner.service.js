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
var BackupRestoreRunnerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackupRestoreRunnerService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const audit_log_service_1 = require("../../common/audit/audit-log.service");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const backup_config_1 = require("./backup-config");
const backup_maintenance_service_1 = require("./backup-maintenance.service");
const backup_storage_service_1 = require("./backup-storage.service");
const backup_operations_service_1 = require("./backup-operations.service");
const backup_pg_tools_service_1 = require("./backup-pg-tools.service");
let BackupRestoreRunnerService = BackupRestoreRunnerService_1 = class BackupRestoreRunnerService {
    prisma;
    backupConfig;
    storage;
    pg;
    maintenance;
    operations;
    audit;
    logger = new common_1.Logger(BackupRestoreRunnerService_1.name);
    progressCache = new Map();
    constructor(prisma, backupConfig, storage, pg, maintenance, operations, audit) {
        this.prisma = prisma;
        this.backupConfig = backupConfig;
        this.storage = storage;
        this.pg = pg;
        this.maintenance = maintenance;
        this.operations = operations;
        this.audit = audit;
    }
    enqueueRestore(restoreJobId, sourceBackupId, user, createPreSnapshot) {
        if (!this.operations.tryAcquire(restoreJobId)) {
            void this.markFailed(restoreJobId, 'Another backup operation is already running.', user.id);
            return;
        }
        void this.runRestore(restoreJobId, sourceBackupId, user, createPreSnapshot).finally(() => {
            this.operations.release(restoreJobId);
            this.maintenance.disable();
        });
    }
    async runRestore(restoreJobId, sourceBackupId, user, createPreSnapshot) {
        let preSnapshotId = null;
        try {
            this.maintenance.enable('backup_restore');
            const source = await this.prisma.backupJob.findUnique({ where: { id: sourceBackupId } });
            if (!source || source.status !== client_1.BackupJobStatus.completed) {
                throw new Error('Source backup is not available for restore.');
            }
            const sourcePath = this.storage.resolveDumpPath(source.artifactPath, source.dumpFilename, sourceBackupId);
            const sourceSize = await this.storage.fileSize(sourcePath);
            if (sourceSize <= 0)
                throw new Error('Source dump file is missing on disk.');
            const validation = await this.pg.validateDumpFile(sourcePath);
            if (!validation.valid) {
                throw new Error(validation.error ?? 'Invalid dump file.');
            }
            const manifest = source.manifest;
            if (manifest?.environmentId && manifest.environmentId !== this.backupConfig.environmentId) {
                throw new Error(`Backup environment "${manifest.environmentId}" does not match current "${this.backupConfig.environmentId}".`);
            }
            if (manifest?.checksumSha256) {
                const actual = await this.storage.sha256File(sourcePath);
                if (actual !== manifest.checksumSha256) {
                    throw new Error('Backup file checksum does not match manifest.');
                }
            }
            await this.prisma.backupJob.update({
                where: { id: restoreJobId },
                data: {
                    status: client_1.BackupJobStatus.running,
                    startedAt: new Date(),
                    progressPercent: 5,
                },
            });
            if (createPreSnapshot || this.backupConfig.preSnapshotRequired) {
                preSnapshotId = await this.createPreSnapshot(restoreJobId, user);
                await this.updateProgress(restoreJobId, 25, 0);
            }
            await this.updateProgress(restoreJobId, 35, sourceSize);
            await this.pg.runPgRestoreFullReplace(sourcePath);
            this.setCachedProgress(restoreJobId, 75, sourceSize);
            await this.pg.runPrismaMigrateDeploy();
            this.setCachedProgress(restoreJobId, 90, sourceSize);
            await this.pg.reconnectPrisma();
            await this.persistJobCompletion(restoreJobId, user.id, {
                sourceBackupId,
                preSnapshotId,
                label: `restore:${sourceBackupId}`,
            });
            await this.audit.log(this.audit.fromPrincipal(user, {
                action: 'backup.restored',
                resourceType: 'backup_job',
                resourceId: restoreJobId,
                newState: {
                    message: `${user.email ?? user.id} restored backup ${sourceBackupId}`,
                    restoreJobId,
                    sourceBackupId,
                    preSnapshotId,
                },
            }));
            await this.pg.invalidateAllSessions();
            this.setCachedProgress(restoreJobId, 98, sourceSize);
            this.logger.log(`Restore ${restoreJobId} completed from source ${sourceBackupId}`);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error(`Restore ${restoreJobId} failed: ${message}`);
            if (preSnapshotId) {
                try {
                    await this.rollbackFromSnapshot(preSnapshotId, restoreJobId);
                    await this.markFailed(restoreJobId, `${message} — automatic rollback from pre-snapshot ${preSnapshotId} completed.`, user.id);
                }
                catch (rollbackErr) {
                    const rollbackMsg = rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr);
                    await this.markFailed(restoreJobId, `${message} — rollback failed: ${rollbackMsg}. Manual recovery required using pre-snapshot ${preSnapshotId}.`, user.id);
                }
            }
            else {
                await this.markFailed(restoreJobId, message, user.id);
            }
            await this.audit.logBestEffort(this.audit.fromPrincipal(user, {
                action: 'backup.restore_failed',
                resourceType: 'backup_job',
                resourceId: restoreJobId,
                newState: { message, preSnapshotId, sourceBackupId },
            }));
        }
    }
    async rollbackFromSnapshot(preSnapshotId, restoreJobId) {
        this.logger.warn(`Rolling back restore ${restoreJobId} from pre-snapshot ${preSnapshotId}`);
        const snap = await this.prisma.backupJob.findUnique({ where: { id: preSnapshotId } });
        if (!snap?.artifactPath || !snap.dumpFilename) {
            throw new Error('Pre-snapshot artifacts are missing.');
        }
        const snapPath = this.storage.resolveDumpPath(snap.artifactPath, snap.dumpFilename, preSnapshotId);
        await this.pg.runPgRestoreFullReplace(snapPath);
        await this.pg.runPrismaMigrateDeploy();
        await this.pg.reconnectPrisma();
        await this.pg.invalidateAllSessions();
    }
    async createPreSnapshot(parentRestoreJobId, user) {
        const preJob = await this.prisma.backupJob.create({
            data: {
                type: client_1.BackupJobType.pre_snapshot,
                status: client_1.BackupJobStatus.running,
                label: `pre-restore:${parentRestoreJobId}`,
                triggeredByUserId: user.id,
                parentJobId: parentRestoreJobId,
                startedAt: new Date(),
                progressPercent: 0,
            },
        });
        const preId = preJob.id;
        await this.storage.ensureJobDir(preId);
        const artifactPath = this.storage.jobDirectory(preId);
        const dumpFilename = `${preId}.dump`;
        const dumpPath = this.storage.dumpPath(preId);
        const dbName = this.pg.parseDbName(this.pg.getDatabaseUrl());
        await this.pg.runPgDump(dumpPath);
        const sizeBytes = await this.storage.fileSize(dumpPath);
        const checksumSha256 = await this.storage.sha256File(dumpPath);
        const manifest = {
            backupId: preId,
            type: client_1.BackupJobType.pre_snapshot,
            label: preJob.label,
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
        await this.storage.writeManifest(preId, manifest);
        await this.prisma.backupJob.update({
            where: { id: preId },
            data: {
                status: client_1.BackupJobStatus.completed,
                progressPercent: 100,
                artifactPath,
                dumpFilename,
                bytesWritten: BigInt(sizeBytes),
                manifest: manifest,
                completedAt: new Date(),
            },
        });
        return preId;
    }
    async updateProgress(jobId, progressPercent, bytesWritten) {
        this.setCachedProgress(jobId, progressPercent, bytesWritten);
        try {
            await this.prisma.backupJob.update({
                where: { id: jobId },
                data: {
                    progressPercent: Math.max(0, Math.min(100, progressPercent)),
                    bytesWritten: BigInt(Math.max(0, bytesWritten)),
                },
            });
        }
        catch {
        }
    }
    setCachedProgress(jobId, progressPercent, bytesWritten) {
        this.progressCache.set(jobId, {
            progressPercent: Math.max(0, Math.min(100, progressPercent)),
            bytesWritten: Math.max(0, bytesWritten),
        });
    }
    async persistJobCompletion(jobId, triggeredByUserId, manifest) {
        const cached = this.progressCache.get(jobId);
        const data = {
            type: client_1.BackupJobType.restore,
            status: client_1.BackupJobStatus.completed,
            progressPercent: 100,
            bytesWritten: BigInt(cached?.bytesWritten ?? 0),
            completedAt: new Date(),
            errorMessage: null,
            manifest: manifest,
            triggeredByUserId,
            label: String(manifest.label ?? `restore:${manifest.sourceBackupId}`),
        };
        try {
            await this.prisma.backupJob.update({ where: { id: jobId }, data });
        }
        catch {
            await this.prisma.backupJob.create({
                data: { id: jobId, startedAt: new Date(), ...data },
            });
        }
        this.progressCache.delete(jobId);
    }
    async markFailed(jobId, errorMessage, triggeredByUserId) {
        this.progressCache.set(jobId, {
            progressPercent: this.progressCache.get(jobId)?.progressPercent ?? 0,
            bytesWritten: 0,
            status: client_1.BackupJobStatus.failed,
            errorMessage,
        });
        try {
            await this.pg.reconnectPrisma();
            await this.prisma.backupJob.update({
                where: { id: jobId },
                data: {
                    status: client_1.BackupJobStatus.failed,
                    errorMessage,
                    completedAt: new Date(),
                },
            });
        }
        catch {
            try {
                await this.prisma.backupJob.create({
                    data: {
                        id: jobId,
                        type: client_1.BackupJobType.restore,
                        status: client_1.BackupJobStatus.failed,
                        errorMessage,
                        completedAt: new Date(),
                        triggeredByUserId,
                        label: 'restore:failed',
                    },
                });
            }
            catch {
            }
        }
    }
};
exports.BackupRestoreRunnerService = BackupRestoreRunnerService;
exports.BackupRestoreRunnerService = BackupRestoreRunnerService = BackupRestoreRunnerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        backup_config_1.BackupConfig,
        backup_storage_service_1.BackupStorageService,
        backup_pg_tools_service_1.BackupPgToolsService,
        backup_maintenance_service_1.BackupMaintenanceService,
        backup_operations_service_1.BackupOperationsService,
        audit_log_service_1.AuditLogService])
], BackupRestoreRunnerService);
//# sourceMappingURL=backup-restore-runner.service.js.map