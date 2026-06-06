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
exports.BackupDriveIntegrationService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const encryption_service_1 = require("../../common/crypto/encryption.service");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const backup_config_1 = require("./backup-config");
let BackupDriveIntegrationService = class BackupDriveIntegrationService {
    prisma;
    encryption;
    backupConfig;
    constructor(prisma, encryption, backupConfig) {
        this.prisma = prisma;
        this.encryption = encryption;
        this.backupConfig = backupConfig;
    }
    async getStatus() {
        const admin = await this.getAdminStatus();
        return {
            connected: admin.connected,
            folderId: admin.folderId,
            connectedAt: admin.connectedAt,
            connectedBy: admin.connectedBy,
        };
    }
    async getAdminStatus() {
        const base = await this.getConnectionView();
        const [lastSynced, pendingSyncCount, failedSyncCount, syncFailures] = await Promise.all([
            this.prisma.backupJob.findFirst({
                where: { gdriveSyncStatus: client_1.BackupDriveSyncStatus.synced },
                orderBy: { gdriveSyncedAt: 'desc' },
                select: { gdriveSyncedAt: true },
            }),
            this.prisma.backupJob.count({
                where: {
                    status: client_1.BackupJobStatus.completed,
                    gdriveSyncStatus: client_1.BackupDriveSyncStatus.pending,
                },
            }),
            this.prisma.backupJob.count({
                where: {
                    status: client_1.BackupJobStatus.completed,
                    gdriveSyncStatus: client_1.BackupDriveSyncStatus.failed,
                },
            }),
            this.prisma.backupJob.findMany({
                where: {
                    status: client_1.BackupJobStatus.completed,
                    gdriveSyncStatus: client_1.BackupDriveSyncStatus.failed,
                },
                orderBy: [{ completedAt: 'desc' }, { createdAt: 'desc' }],
                take: 50,
                select: {
                    id: true,
                    type: true,
                    label: true,
                    completedAt: true,
                    storagePolicy: true,
                    gdriveSyncError: true,
                    gdriveSyncAttempts: true,
                    gdriveNextRetryAt: true,
                },
            }),
        ]);
        return {
            ...base,
            rootFolderName: this.backupConfig.gdriveRootFolderName,
            gdriveEnabled: this.backupConfig.gdriveEnabled,
            gdriveConfigured: this.backupConfig.gdriveConfigured(),
            lastSyncedAt: lastSynced?.gdriveSyncedAt?.toISOString() ?? null,
            pendingSyncCount,
            failedSyncCount,
            syncFailures: syncFailures.map((row) => ({
                id: row.id,
                type: row.type,
                label: row.label,
                completedAt: row.completedAt?.toISOString() ?? null,
                storagePolicy: row.storagePolicy,
                gdriveSyncError: row.gdriveSyncError,
                gdriveSyncAttempts: row.gdriveSyncAttempts,
                gdriveNextRetryAt: row.gdriveNextRetryAt?.toISOString() ?? null,
            })),
        };
    }
    async getConnectionView() {
        const row = await this.prisma.backupDriveIntegration.findFirst({
            orderBy: { connectedAt: 'desc' },
            include: {
                connectedBy: { select: { id: true, email: true, fullName: true } },
            },
        });
        if (!row) {
            return {
                connected: false,
                folderId: null,
                connectedAt: null,
                connectedBy: null,
            };
        }
        return {
            connected: true,
            folderId: this.encryption.decrypt(row.encryptedFolderId),
            connectedAt: row.connectedAt.toISOString(),
            connectedBy: row.connectedBy,
        };
    }
    async isConnected() {
        const count = await this.prisma.backupDriveIntegration.count();
        return count > 0;
    }
    async getRefreshToken() {
        const row = await this.prisma.backupDriveIntegration.findFirst({
            orderBy: { connectedAt: 'desc' },
        });
        if (!row)
            return null;
        return this.encryption.decrypt(row.encryptedRefreshToken);
    }
    async getFolderId() {
        const row = await this.prisma.backupDriveIntegration.findFirst({
            orderBy: { connectedAt: 'desc' },
        });
        if (!row)
            return null;
        return this.encryption.decrypt(row.encryptedFolderId);
    }
    async saveConnection(input) {
        const encryptedRefreshToken = this.encryption.encrypt(input.refreshToken);
        const encryptedFolderId = this.encryption.encrypt(input.folderId);
        await this.prisma.$transaction([
            this.prisma.backupDriveIntegration.deleteMany(),
            this.prisma.backupDriveIntegration.create({
                data: {
                    encryptedRefreshToken,
                    encryptedFolderId,
                    connectedByUserId: input.connectedByUserId,
                    connectedAt: new Date(),
                },
            }),
        ]);
    }
    async disconnect() {
        const result = await this.prisma.backupDriveIntegration.deleteMany();
        return result.count > 0;
    }
};
exports.BackupDriveIntegrationService = BackupDriveIntegrationService;
exports.BackupDriveIntegrationService = BackupDriveIntegrationService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        encryption_service_1.EncryptionService,
        backup_config_1.BackupConfig])
], BackupDriveIntegrationService);
//# sourceMappingURL=backup-drive-integration.service.js.map