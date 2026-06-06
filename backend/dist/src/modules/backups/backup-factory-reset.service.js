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
var BackupFactoryResetService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackupFactoryResetService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const audit_log_service_1 = require("../../common/audit/audit-log.service");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const backup_bootstrap_constants_1 = require("./backup-bootstrap.constants");
const backup_config_1 = require("./backup-config");
const backup_maintenance_service_1 = require("./backup-maintenance.service");
const backup_storage_service_1 = require("./backup-storage.service");
const backup_operations_service_1 = require("./backup-operations.service");
const backup_pg_tools_service_1 = require("./backup-pg-tools.service");
let BackupFactoryResetService = BackupFactoryResetService_1 = class BackupFactoryResetService {
    prisma;
    backupConfig;
    storage;
    pg;
    maintenance;
    operations;
    audit;
    logger = new common_1.Logger(BackupFactoryResetService_1.name);
    constructor(prisma, backupConfig, storage, pg, maintenance, operations, audit) {
        this.prisma = prisma;
        this.backupConfig = backupConfig;
        this.storage = storage;
        this.pg = pg;
        this.maintenance = maintenance;
        this.operations = operations;
        this.audit = audit;
    }
    enqueueFactoryReset(resetJobId, user, createPreSnapshot) {
        if (!this.operations.tryAcquire(resetJobId)) {
            void this.markFailed(resetJobId, 'Another backup operation is already running.');
            return;
        }
        void this.runFactoryReset(resetJobId, user, createPreSnapshot).finally(() => {
            this.operations.release(resetJobId);
            this.maintenance.disable();
        });
    }
    async runFactoryReset(resetJobId, user, createPreSnapshot) {
        let preSnapshotId = null;
        try {
            this.maintenance.enable('factory_reset');
            await this.prisma.backupJob.update({
                where: { id: resetJobId },
                data: {
                    status: client_1.BackupJobStatus.running,
                    startedAt: new Date(),
                    progressPercent: 5,
                },
            });
            if (createPreSnapshot || this.backupConfig.preSnapshotRequired) {
                preSnapshotId = await this.createPreSnapshot(resetJobId, user);
                await this.updateProgress(resetJobId, 20, 0);
            }
            await this.updateProgress(resetJobId, 30, 0);
            await this.wipeBusinessData();
            await this.updateProgress(resetJobId, 55, 0);
            await this.pg.runDbSeed();
            await this.updateProgress(resetJobId, 80, 0);
            await this.ensureSuperAdminPreserved();
            await this.updateProgress(resetJobId, 92, 0);
            await this.pg.invalidateAllSessions();
            await this.updateProgress(resetJobId, 98, 0);
            await this.prisma.backupJob.update({
                where: { id: resetJobId },
                data: {
                    status: client_1.BackupJobStatus.completed,
                    progressPercent: 100,
                    completedAt: new Date(),
                    errorMessage: null,
                    manifest: {
                        preSnapshotId,
                        resetAt: new Date().toISOString(),
                        preservedSuperAdminId: backup_bootstrap_constants_1.SUPER_ADMIN_ID,
                    },
                },
            });
            await this.audit.log(this.audit.fromPrincipal(user, {
                action: 'system.factory_reset',
                resourceType: 'backup_job',
                resourceId: resetJobId,
                newState: {
                    message: `${user.email ?? user.id} executed factory reset`,
                    resetJobId,
                    preSnapshotId,
                },
            }));
            this.logger.log(`Factory reset ${resetJobId} completed`);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error(`Factory reset ${resetJobId} failed: ${message}`);
            if (preSnapshotId) {
                try {
                    const snap = await this.prisma.backupJob.findUnique({ where: { id: preSnapshotId } });
                    if (snap?.artifactPath && snap.dumpFilename) {
                        const snapPath = this.storage.resolveDumpPath(snap.artifactPath, snap.dumpFilename, preSnapshotId);
                        await this.pg.runPgRestoreFullReplace(snapPath);
                        await this.pg.runPrismaMigrateDeploy();
                        await this.pg.invalidateAllSessions();
                        await this.markFailed(resetJobId, `${message} — automatic rollback from pre-snapshot ${preSnapshotId} completed.`);
                    }
                    else {
                        await this.markFailed(resetJobId, `${message} — rollback snapshot missing.`);
                    }
                }
                catch (rollbackErr) {
                    const rollbackMsg = rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr);
                    await this.markFailed(resetJobId, `${message} — rollback failed: ${rollbackMsg}. Use pre-snapshot ${preSnapshotId}.`);
                }
            }
            else {
                await this.markFailed(resetJobId, message);
            }
            await this.audit.logBestEffort(this.audit.fromPrincipal(user, {
                action: 'system.factory_reset_failed',
                resourceType: 'backup_job',
                resourceId: resetJobId,
                newState: { message, preSnapshotId },
            }));
        }
    }
    async wipeBusinessData() {
        for (const table of backup_bootstrap_constants_1.FACTORY_RESET_TRUNCATE_TABLES) {
            await this.prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE`);
        }
        await this.prisma.user.deleteMany({
            where: { id: { not: backup_bootstrap_constants_1.SUPER_ADMIN_ID } },
        });
    }
    async ensureSuperAdminPreserved() {
        const admin = await this.prisma.user.findUnique({ where: { id: backup_bootstrap_constants_1.SUPER_ADMIN_ID } });
        if (!admin || admin.role !== client_1.UserRole.super_admin) {
            throw new Error(`Super admin account ${backup_bootstrap_constants_1.SUPER_ADMIN_EMAIL} was not preserved after factory reset.`);
        }
    }
    async createPreSnapshot(parentJobId, user) {
        const preJob = await this.prisma.backupJob.create({
            data: {
                type: client_1.BackupJobType.pre_snapshot,
                status: client_1.BackupJobStatus.running,
                label: `pre-reset:${parentJobId}`,
                triggeredByUserId: user.id,
                parentJobId,
                startedAt: new Date(),
            },
        });
        const preId = preJob.id;
        await this.storage.ensureJobDir(preId);
        const artifactPath = this.storage.jobDirectory(preId);
        const dumpFilename = `${preId}.dump`;
        const dumpPath = this.storage.dumpPath(preId);
        await this.pg.runPgDump(dumpPath);
        const sizeBytes = await this.storage.fileSize(dumpPath);
        const checksumSha256 = await this.storage.sha256File(dumpPath);
        const manifest = {
            backupId: preId,
            type: client_1.BackupJobType.pre_snapshot,
            label: preJob.label,
            environmentId: this.backupConfig.environmentId,
            dbName: this.pg.parseDbName(this.pg.getDatabaseUrl()),
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
        await this.prisma.backupJob.update({
            where: { id: jobId },
            data: {
                progressPercent: Math.max(0, Math.min(100, progressPercent)),
                bytesWritten: BigInt(bytesWritten),
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
exports.BackupFactoryResetService = BackupFactoryResetService;
exports.BackupFactoryResetService = BackupFactoryResetService = BackupFactoryResetService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        backup_config_1.BackupConfig,
        backup_storage_service_1.BackupStorageService,
        backup_pg_tools_service_1.BackupPgToolsService,
        backup_maintenance_service_1.BackupMaintenanceService,
        backup_operations_service_1.BackupOperationsService,
        audit_log_service_1.AuditLogService])
], BackupFactoryResetService);
//# sourceMappingURL=backup-factory-reset.service.js.map