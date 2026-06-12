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
exports.BackupsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const rbac_policy_1 = require("../../common/auth/rbac-policy");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const backup_config_1 = require("./backup-config");
const backup_drive_sync_service_1 = require("./backup-drive-sync.service");
const backup_download_token_service_1 = require("./backup-download-token.service");
const backup_factory_reset_service_1 = require("./backup-factory-reset.service");
const backup_maintenance_service_1 = require("./backup-maintenance.service");
const backup_storage_service_1 = require("./backup-storage.service");
const backup_operations_service_1 = require("./backup-operations.service");
const backup_pg_tools_service_1 = require("./backup-pg-tools.service");
const backup_restore_runner_service_1 = require("./backup-restore-runner.service");
const backup_runner_service_1 = require("./backup-runner.service");
const backup_storage_policy_service_1 = require("./backup-storage-policy.service");
const list_backups_query_dto_1 = require("./dto/list-backups-query.dto");
const DOWNLOADABLE_BACKUP_TYPES = [
    client_1.BackupJobType.manual,
    client_1.BackupJobType.scheduled,
    client_1.BackupJobType.upload,
    client_1.BackupJobType.pre_snapshot,
];
let BackupsService = class BackupsService {
    prisma;
    backupConfig;
    storage;
    runner;
    restoreRunner;
    factoryResetRunner;
    operations;
    maintenance;
    pg;
    downloadTokens;
    driveSync;
    storagePolicy;
    constructor(prisma, backupConfig, storage, runner, restoreRunner, factoryResetRunner, operations, maintenance, pg, downloadTokens, driveSync, storagePolicy) {
        this.prisma = prisma;
        this.backupConfig = backupConfig;
        this.storage = storage;
        this.runner = runner;
        this.restoreRunner = restoreRunner;
        this.factoryResetRunner = factoryResetRunner;
        this.operations = operations;
        this.maintenance = maintenance;
        this.pg = pg;
        this.downloadTokens = downloadTokens;
        this.driveSync = driveSync;
        this.storagePolicy = storagePolicy;
    }
    assertEnabled() {
        if (!this.backupConfig.enabled) {
            throw new common_1.ServiceUnavailableException('Backup feature is disabled.');
        }
    }
    assertCanRead(user) {
        if (!(0, rbac_policy_1.isInternalAdminRole)(user.role)) {
            throw new common_1.ForbiddenException('Backup history requires warehouse manager or super admin.');
        }
    }
    async createManual(user, dto) {
        this.assertEnabled();
        if (user.role !== client_1.UserRole.super_admin) {
            throw new common_1.ForbiddenException('Only super admin can create backups.');
        }
        if (this.operations.isBusy()) {
            throw new common_1.BadRequestException('A backup operation is already running.');
        }
        const cooldownMs = this.backupConfig.manualCooldownSec * 1000;
        const recent = await this.prisma.backupJob.findFirst({
            where: {
                type: client_1.BackupJobType.manual,
                triggeredByUserId: user.id,
                createdAt: { gte: new Date(Date.now() - cooldownMs) },
                status: { in: [client_1.BackupJobStatus.pending, client_1.BackupJobStatus.running, client_1.BackupJobStatus.completed] },
            },
            orderBy: { createdAt: 'desc' },
        });
        if (recent) {
            throw new common_1.BadRequestException(`Please wait before creating another manual backup (cooldown ${this.backupConfig.manualCooldownSec}s).`);
        }
        const resolvedPolicy = await this.storagePolicy.resolveForSchedule(dto.storagePolicy ?? null);
        const job = await this.prisma.backupJob.create({
            data: {
                type: client_1.BackupJobType.manual,
                status: client_1.BackupJobStatus.pending,
                label: dto.label?.trim() || null,
                triggeredByUserId: user.id,
                storagePolicy: resolvedPolicy,
                progressPercent: 0,
            },
            select: { id: true, status: true, createdAt: true, storagePolicy: true },
        });
        this.runner.enqueueManual(job.id, user);
        return {
            jobId: job.id,
            status: job.status,
            storagePolicy: job.storagePolicy,
            createdAt: job.createdAt,
        };
    }
    async syncDrive(user, jobId) {
        this.assertEnabled();
        if (user.role !== client_1.UserRole.super_admin) {
            throw new common_1.ForbiddenException('Only super admin can sync backups to Google Drive.');
        }
        const job = await this.prisma.backupJob.findUnique({ where: { id: jobId } });
        if (!job)
            throw new common_1.NotFoundException('Backup job not found.');
        if (job.status !== client_1.BackupJobStatus.completed) {
            throw new common_1.BadRequestException('Only completed backups can be synced to Google Drive.');
        }
        if (!this.storagePolicy.shouldSyncToDrive(job.storagePolicy)) {
            throw new common_1.BadRequestException('This backup uses a local-only storage policy.');
        }
        await this.driveSync.syncJob(jobId, user);
        const updated = await this.prisma.backupJob.findUnique({
            where: { id: jobId },
            select: {
                id: true,
                gdriveSyncStatus: true,
                gdriveFileId: true,
                gdriveSyncedAt: true,
                gdriveSyncError: true,
                gdriveSyncAttempts: true,
                gdriveNextRetryAt: true,
            },
        });
        return updated;
    }
    async list(user, query) {
        this.assertCanRead(user);
        const limit = query.limit ?? 20;
        const offset = query.offset ?? 0;
        const where = this.buildHistoryListWhere(query);
        const [items, total] = await Promise.all([
            this.prisma.backupJob.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip: offset,
                include: {
                    triggeredBy: { select: { id: true, email: true, fullName: true } },
                },
            }),
            this.prisma.backupJob.count({ where }),
        ]);
        return {
            items: items.map((row) => this.toSummary(row)),
            total,
            limit,
            offset,
        };
    }
    buildHistoryListWhere(query) {
        const where = {
            type: query.type ? query.type : { in: list_backups_query_dto_1.BACKUP_HISTORY_JOB_TYPES },
        };
        if (query.status) {
            where.status = query.status;
        }
        const search = query.search?.trim();
        if (search) {
            const or = [
                { label: { contains: search, mode: 'insensitive' } },
                { triggeredBy: { email: { contains: search, mode: 'insensitive' } } },
                { triggeredBy: { fullName: { contains: search, mode: 'insensitive' } } },
            ];
            if (/^[0-9a-f-]{36}$/i.test(search)) {
                or.unshift({ id: search });
            }
            where.OR = or;
        }
        return where;
    }
    async findById(user, id) {
        this.assertCanRead(user);
        const job = await this.prisma.backupJob.findUnique({
            where: { id },
            include: {
                triggeredBy: { select: { id: true, email: true, fullName: true } },
            },
        });
        if (!job)
            throw new common_1.NotFoundException('Backup job not found.');
        return this.toDetail(job);
    }
    async getStatus(user, id) {
        this.assertCanRead(user);
        const job = await this.prisma.backupJob.findUnique({
            where: { id },
            select: {
                id: true,
                status: true,
                progressPercent: true,
                bytesWritten: true,
                errorMessage: true,
                startedAt: true,
                completedAt: true,
            },
        });
        if (!job)
            throw new common_1.NotFoundException('Backup job not found.');
        return {
            id: job.id,
            status: job.status,
            progressPercent: job.progressPercent,
            bytesWritten: Number(job.bytesWritten),
            errorMessage: job.errorMessage,
            startedAt: job.startedAt,
            completedAt: job.completedAt,
        };
    }
    async issueDownload(user, id) {
        this.assertEnabled();
        if (user.role !== client_1.UserRole.super_admin) {
            throw new common_1.ForbiddenException('Only super admin can download backups.');
        }
        const job = await this.prisma.backupJob.findUnique({ where: { id } });
        await this.assertDownloadableJob(job);
        const { token, expiresAt, expiresInSec } = this.downloadTokens.issue(id, user.id);
        const downloadUrl = this.downloadTokens.buildDownloadUrl(id, token);
        return {
            backupId: id,
            token,
            downloadUrl,
            expiresAt,
            expiresInSec,
        };
    }
    getActiveOperation() {
        return {
            busy: this.operations.isBusy(),
            activeJobId: this.operations.getActiveJobId(),
            maintenance: this.maintenance.isActive(),
            maintenanceReason: this.maintenance.getReason(),
        };
    }
    async uploadBackup(user, file) {
        this.assertEnabled();
        if (user.role !== client_1.UserRole.super_admin) {
            throw new common_1.ForbiddenException('Only super admin can upload backups.');
        }
        if (!file?.path) {
            throw new common_1.BadRequestException('Backup file is required.');
        }
        if (!file.originalname.toLowerCase().endsWith('.dump')) {
            throw new common_1.BadRequestException('Only PostgreSQL custom dump files (.dump) are accepted.');
        }
        if (file.size > this.backupConfig.maxUploadBytes) {
            throw new common_1.BadRequestException('Uploaded file exceeds maximum allowed size.');
        }
        const resolvedPolicy = await this.storagePolicy.resolveDefault();
        const job = await this.prisma.backupJob.create({
            data: {
                type: client_1.BackupJobType.upload,
                status: client_1.BackupJobStatus.running,
                label: file.originalname,
                triggeredByUserId: user.id,
                storagePolicy: resolvedPolicy,
                startedAt: new Date(),
                progressPercent: 10,
            },
        });
        try {
            await this.storage.ensureJobDir(job.id);
            const artifactPath = this.storage.jobDirectory(job.id);
            const dumpFilename = `${job.id}.dump`;
            const dumpPath = this.storage.dumpPath(job.id);
            await (0, promises_1.copyFile)(file.path, dumpPath);
            await (0, promises_1.unlink)(file.path).catch(() => undefined);
            const validation = await this.pg.validateDumpFile(dumpPath);
            if (!validation.valid) {
                throw new common_1.BadRequestException(validation.error ?? 'Invalid backup file.');
            }
            const sizeBytes = await this.storage.fileSize(dumpPath);
            const checksumSha256 = await this.storage.sha256File(dumpPath);
            const manifest = {
                backupId: job.id,
                type: client_1.BackupJobType.upload,
                label: file.originalname,
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
            await this.storage.writeManifest(job.id, manifest);
            await this.prisma.backupJob.update({
                where: { id: job.id },
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
            this.driveSync.enqueue(job.id, user);
            return {
                jobId: job.id,
                status: client_1.BackupJobStatus.completed,
                sizeBytes,
                checksumSha256,
                tocEntries: validation.tocEntries,
            };
        }
        catch (err) {
            await this.storage.removeJobArtifacts(job.id).catch(() => undefined);
            await this.prisma.backupJob.update({
                where: { id: job.id },
                data: {
                    status: client_1.BackupJobStatus.failed,
                    errorMessage: err instanceof Error ? err.message : String(err),
                    completedAt: new Date(),
                },
            });
            throw err;
        }
    }
    async restoreBackup(user, sourceBackupId, dto) {
        this.assertEnabled();
        if (user.role !== client_1.UserRole.super_admin) {
            throw new common_1.ForbiddenException('Only super admin can restore backups.');
        }
        if (this.operations.isBusy()) {
            throw new common_1.BadRequestException('A backup operation is already running.');
        }
        const source = await this.prisma.backupJob.findUnique({ where: { id: sourceBackupId } });
        if (!source)
            throw new common_1.NotFoundException('Source backup not found.');
        if (source.status !== client_1.BackupJobStatus.completed) {
            throw new common_1.BadRequestException('Source backup must be completed before restore.');
        }
        if (source.type !== client_1.BackupJobType.manual && source.type !== client_1.BackupJobType.upload) {
            throw new common_1.BadRequestException('This backup type cannot be used as a restore source.');
        }
        const restoreJob = await this.prisma.backupJob.create({
            data: {
                type: client_1.BackupJobType.restore,
                status: client_1.BackupJobStatus.pending,
                label: `restore:${sourceBackupId}`,
                triggeredByUserId: user.id,
                parentJobId: sourceBackupId,
                progressPercent: 0,
            },
        });
        this.restoreRunner.enqueueRestore(restoreJob.id, sourceBackupId, user, dto.createPreSnapshot !== false);
        return {
            restoreJobId: restoreJob.id,
            sourceBackupId,
            status: restoreJob.status,
        };
    }
    async factoryReset(user, dto) {
        this.assertEnabled();
        if (user.role !== client_1.UserRole.super_admin) {
            throw new common_1.ForbiddenException('Only super admin can execute factory reset.');
        }
        if (!this.backupConfig.factoryResetEnabled) {
            throw new common_1.ForbiddenException('Factory reset is disabled on this environment.');
        }
        if (this.operations.isBusy()) {
            throw new common_1.BadRequestException('A backup operation is already running.');
        }
        const resetJob = await this.prisma.backupJob.create({
            data: {
                type: client_1.BackupJobType.factory_reset,
                status: client_1.BackupJobStatus.pending,
                label: 'factory-reset',
                triggeredByUserId: user.id,
                progressPercent: 0,
            },
        });
        this.factoryResetRunner.enqueueFactoryReset(resetJob.id, user, dto.createPreSnapshot !== false);
        return {
            resetJobId: resetJob.id,
            status: resetJob.status,
        };
    }
    async streamDownload(user, id, token) {
        this.assertEnabled();
        if (user.role !== client_1.UserRole.super_admin) {
            throw new common_1.ForbiddenException('Only super admin can download backups.');
        }
        this.downloadTokens.verify(token, id, user.id);
        const job = await this.prisma.backupJob.findUnique({ where: { id } });
        await this.assertDownloadableJob(job);
        const filePath = this.storage.resolveDumpPath(job.artifactPath, job.dumpFilename, id);
        const sizeBytes = await this.storage.fileSize(filePath);
        if (sizeBytes <= 0) {
            throw new common_1.NotFoundException('Backup dump file is missing on disk.');
        }
        const filename = job.dumpFilename ?? `${id}.dump`;
        return {
            stream: (0, fs_1.createReadStream)(filePath),
            filename,
            sizeBytes,
        };
    }
    async assertDownloadableJob(job) {
        if (!job)
            throw new common_1.NotFoundException('Backup job not found.');
        if (job.status !== client_1.BackupJobStatus.completed) {
            throw new common_1.BadRequestException('Backup is not ready for download.');
        }
        if (!DOWNLOADABLE_BACKUP_TYPES.includes(job.type)) {
            throw new common_1.BadRequestException(`Backup type "${job.type}" does not have a downloadable dump file.`);
        }
        const filePath = this.storage.resolveDumpPath(job.artifactPath, job.dumpFilename, job.id);
        const sizeBytes = await this.storage.fileSize(filePath);
        if (sizeBytes <= 0) {
            throw new common_1.NotFoundException('Backup dump file is missing on disk.');
        }
    }
    toSummary(row) {
        return {
            id: row.id,
            type: row.type,
            status: row.status,
            label: row.label,
            progressPercent: row.progressPercent,
            bytesWritten: Number(row.bytesWritten),
            createdAt: row.createdAt,
            completedAt: row.completedAt,
            triggeredBy: row.triggeredBy,
            manifest: row.manifest,
            storagePolicy: row.storagePolicy,
            gdriveSyncStatus: row.gdriveSyncStatus,
            gdriveSyncedAt: row.gdriveSyncedAt,
        };
    }
    toDetail(row) {
        return {
            ...this.toSummary(row),
            dumpFilename: row.dumpFilename,
            errorMessage: row.errorMessage,
            startedAt: row.startedAt,
            gdriveFileId: row.gdriveFileId,
            gdriveSyncError: row.gdriveSyncError,
            gdriveSyncAttempts: row.gdriveSyncAttempts,
            gdriveNextRetryAt: row.gdriveNextRetryAt,
        };
    }
};
exports.BackupsService = BackupsService;
exports.BackupsService = BackupsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        backup_config_1.BackupConfig,
        backup_storage_service_1.BackupStorageService,
        backup_runner_service_1.BackupRunnerService,
        backup_restore_runner_service_1.BackupRestoreRunnerService,
        backup_factory_reset_service_1.BackupFactoryResetService,
        backup_operations_service_1.BackupOperationsService,
        backup_maintenance_service_1.BackupMaintenanceService,
        backup_pg_tools_service_1.BackupPgToolsService,
        backup_download_token_service_1.BackupDownloadTokenService,
        backup_drive_sync_service_1.BackupDriveSyncService,
        backup_storage_policy_service_1.BackupStoragePolicyService])
], BackupsService);
//# sourceMappingURL=backups.service.js.map