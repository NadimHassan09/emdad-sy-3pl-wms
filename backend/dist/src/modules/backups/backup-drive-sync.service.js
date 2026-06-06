"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var BackupDriveSyncService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackupDriveSyncService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const promises_1 = require("node:fs/promises");
const path = __importStar(require("node:path"));
const audit_log_service_1 = require("../../common/audit/audit-log.service");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const backup_config_1 = require("./backup-config");
const backup_drive_retry_util_1 = require("./backup-drive-retry.util");
const backup_drive_integration_service_1 = require("./backup-drive-integration.service");
const backup_drive_service_1 = require("./backup-drive.service");
const backup_file_encryption_service_1 = require("./backup-file-encryption.service");
const backup_storage_policy_service_1 = require("./backup-storage-policy.service");
const backup_storage_service_1 = require("./backup-storage.service");
const DRIVE_UPLOADABLE_TYPES = [
    client_1.BackupJobType.manual,
    client_1.BackupJobType.scheduled,
    client_1.BackupJobType.upload,
    client_1.BackupJobType.pre_snapshot,
];
let BackupDriveSyncService = BackupDriveSyncService_1 = class BackupDriveSyncService {
    prisma;
    backupConfig;
    storage;
    integration;
    drive;
    fileEncryption;
    storagePolicy;
    audit;
    logger = new common_1.Logger(BackupDriveSyncService_1.name);
    constructor(prisma, backupConfig, storage, integration, drive, fileEncryption, storagePolicy, audit) {
        this.prisma = prisma;
        this.backupConfig = backupConfig;
        this.storage = storage;
        this.integration = integration;
        this.drive = drive;
        this.fileEncryption = fileEncryption;
        this.storagePolicy = storagePolicy;
        this.audit = audit;
    }
    enqueue(jobId, user) {
        void this.enqueueInternal(jobId, user).catch((err) => {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error(`Drive sync enqueue failed for ${jobId}: ${message}`);
        });
    }
    async enqueueInternal(jobId, user) {
        if (!this.backupConfig.gdriveEnabled)
            return;
        const job = await this.prisma.backupJob.findUnique({ where: { id: jobId } });
        if (!job || job.status !== 'completed')
            return;
        if (!this.storagePolicy.shouldSyncToDrive(job.storagePolicy))
            return;
        void this.syncJob(jobId, user).catch((err) => {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error(`Drive sync failed for ${jobId}: ${message}`);
        });
    }
    async syncJob(jobId, user, options = {}) {
        if (!this.backupConfig.gdriveEnabled)
            return;
        const connected = await this.integration.isConnected();
        if (!connected)
            return;
        const job = await this.prisma.backupJob.findUnique({ where: { id: jobId } });
        if (!job || job.status !== 'completed')
            return;
        if (!DRIVE_UPLOADABLE_TYPES.includes(job.type))
            return;
        if (!this.storagePolicy.shouldSyncToDrive(job.storagePolicy))
            return;
        const dumpPath = this.storage.resolveDumpPath(job.artifactPath, job.dumpFilename, jobId);
        const dumpSize = await this.storage.fileSize(dumpPath);
        if (dumpSize <= 0) {
            this.logger.warn(`Skipping Drive upload for ${jobId}: local dump missing.`);
            return;
        }
        const refreshToken = await this.integration.getRefreshToken();
        const folderId = await this.integration.getFolderId();
        if (!refreshToken || !folderId)
            return;
        const attempt = options.isRetry ? job.gdriveSyncAttempts + 1 : Math.max(1, job.gdriveSyncAttempts + 1);
        await this.prisma.backupJob.update({
            where: { id: jobId },
            data: {
                gdriveSyncStatus: client_1.BackupDriveSyncStatus.pending,
                gdriveSyncError: null,
                gdriveNextRetryAt: null,
                gdriveSyncAttempts: attempt,
            },
        });
        if (options.isRetry) {
            await this.audit.logBestEffort(this.audit.fromPrincipal(user, {
                action: 'backup.drive.retry_attempted',
                resourceType: 'backup_job',
                resourceId: jobId,
                newState: {
                    message: `Drive upload retry attempt ${attempt} for backup ${jobId}`,
                    backupId: jobId,
                    attempt,
                    storagePolicy: job.storagePolicy,
                },
            }));
        }
        const encFilename = `${jobId}.dump.enc`;
        const encPath = path.join(this.storage.jobDirectory(jobId), encFilename);
        try {
            const encSize = await this.fileEncryption.encryptDumpFile(dumpPath, encPath);
            if (this.backupConfig.gdriveSimulateUploadFailure) {
                throw new Error('Simulated Google Drive upload failure (BACKUP_GDRIVE_SIMULATE_UPLOAD_FAILURE).');
            }
            const gdriveFileId = await this.drive.uploadEncryptedDump({
                refreshToken,
                rootFolderId: folderId,
                environmentId: this.backupConfig.environmentId,
                jobId,
                encFilePath: encPath,
                encFilename,
            });
            await this.prisma.backupJob.update({
                where: { id: jobId },
                data: {
                    storageDestination: client_1.BackupStorageDestination.google_drive,
                    gdriveFileId,
                    gdriveSyncedAt: new Date(),
                    gdriveSyncStatus: client_1.BackupDriveSyncStatus.synced,
                    gdriveSyncError: null,
                    gdriveNextRetryAt: null,
                },
            });
            await this.audit.log(this.audit.fromPrincipal(user, {
                action: 'backup.drive.uploaded',
                resourceType: 'backup_job',
                resourceId: jobId,
                newState: {
                    message: `${user.email ?? user.id} uploaded encrypted backup ${jobId} to Google Drive`,
                    backupId: jobId,
                    gdriveFileId,
                    encFilename,
                    encSizeBytes: encSize,
                    storageDestination: client_1.BackupStorageDestination.google_drive,
                    storagePolicy: job.storagePolicy,
                    attempt,
                },
            }));
            if (job.storagePolicy === client_1.BackupStoragePolicy.drive_only) {
                await this.purgeLocalArtifacts(jobId);
            }
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            const maxAttempts = this.backupConfig.gdriveRetryMaxAttempts;
            const exhausted = attempt >= maxAttempts;
            const nextRetryAt = exhausted
                ? null
                : new Date(Date.now() +
                    (0, backup_drive_retry_util_1.computeDriveRetryDelayMs)(attempt, this.backupConfig.gdriveRetryBaseSec, this.backupConfig.gdriveRetryMaxSec));
            await this.prisma.backupJob.update({
                where: { id: jobId },
                data: {
                    gdriveSyncStatus: client_1.BackupDriveSyncStatus.failed,
                    gdriveSyncError: message.slice(0, 2000),
                    gdriveNextRetryAt: nextRetryAt,
                },
            });
            if (exhausted) {
                await this.audit.logBestEffort(this.audit.fromPrincipal(user, {
                    action: 'backup.drive.upload_failed',
                    resourceType: 'backup_job',
                    resourceId: jobId,
                    newState: {
                        message: `Drive upload failed permanently for backup ${jobId}`,
                        backupId: jobId,
                        attempt,
                        maxAttempts,
                        error: message.slice(0, 500),
                        storagePolicy: job.storagePolicy,
                    },
                }));
            }
            else {
                await this.audit.logBestEffort(this.audit.fromPrincipal(user, {
                    action: 'backup.drive.retry_scheduled',
                    resourceType: 'backup_job',
                    resourceId: jobId,
                    newState: {
                        message: `Drive upload failed for backup ${jobId}; retry scheduled`,
                        backupId: jobId,
                        attempt,
                        maxAttempts,
                        nextRetryAt: nextRetryAt?.toISOString() ?? null,
                        error: message.slice(0, 500),
                        storagePolicy: job.storagePolicy,
                    },
                }));
            }
            throw err;
        }
        finally {
            await (0, promises_1.unlink)(encPath).catch(() => undefined);
        }
    }
    async purgeLocalArtifacts(jobId) {
        await this.storage.removeJobDirectory(jobId);
        await this.prisma.backupJob.update({
            where: { id: jobId },
            data: {
                localArtifactPurged: true,
                artifactPath: null,
                dumpFilename: null,
            },
        });
        this.logger.log(`Purged local artifacts for drive_only backup ${jobId}`);
    }
};
exports.BackupDriveSyncService = BackupDriveSyncService;
exports.BackupDriveSyncService = BackupDriveSyncService = BackupDriveSyncService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        backup_config_1.BackupConfig,
        backup_storage_service_1.BackupStorageService,
        backup_drive_integration_service_1.BackupDriveIntegrationService,
        backup_drive_service_1.BackupDriveService,
        backup_file_encryption_service_1.BackupFileEncryptionService,
        backup_storage_policy_service_1.BackupStoragePolicyService,
        audit_log_service_1.AuditLogService])
], BackupDriveSyncService);
//# sourceMappingURL=backup-drive-sync.service.js.map