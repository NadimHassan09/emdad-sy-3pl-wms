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
exports.BackupStoragePolicyService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const audit_log_service_1 = require("../../common/audit/audit-log.service");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const backup_bootstrap_constants_1 = require("./backup-bootstrap.constants");
const backup_config_1 = require("./backup-config");
const backup_drive_integration_service_1 = require("./backup-drive-integration.service");
let BackupStoragePolicyService = class BackupStoragePolicyService {
    prisma;
    backupConfig;
    audit;
    driveIntegration;
    constructor(prisma, backupConfig, audit, driveIntegration) {
        this.prisma = prisma;
        this.backupConfig = backupConfig;
        this.audit = audit;
        this.driveIntegration = driveIntegration;
    }
    async getSettings() {
        const row = await this.ensureSettingsRow();
        return {
            defaultPolicy: row.defaultPolicy,
            envFallbackPolicy: this.backupConfig.defaultStoragePolicy,
            effectiveDefaultPolicy: row.defaultPolicy,
            updatedAt: row.updatedAt,
            updatedByUserId: row.updatedByUserId,
        };
    }
    async updateDefaultPolicy(user, dto) {
        await this.assertDrivePolicyAllowed(dto.defaultPolicy);
        const row = await this.prisma.backupStorageSettings.upsert({
            where: { id: backup_bootstrap_constants_1.STORAGE_SETTINGS_ID },
            create: {
                id: backup_bootstrap_constants_1.STORAGE_SETTINGS_ID,
                defaultPolicy: dto.defaultPolicy,
                updatedByUserId: user.id,
            },
            update: {
                defaultPolicy: dto.defaultPolicy,
                updatedByUserId: user.id,
            },
        });
        await this.audit.log(this.audit.fromPrincipal(user, {
            action: 'backup.storage_policy.updated',
            resourceType: 'backup_storage_settings',
            resourceId: backup_bootstrap_constants_1.STORAGE_SETTINGS_ID,
            newState: {
                message: `${user.email ?? user.id} updated default backup storage policy`,
                defaultPolicy: row.defaultPolicy,
            },
        }));
        return {
            defaultPolicy: row.defaultPolicy,
            updatedAt: row.updatedAt,
        };
    }
    async resolveForSchedule(schedulePolicy) {
        if (schedulePolicy)
            return this.effectivePolicy(schedulePolicy);
        return this.resolveDefault();
    }
    async resolveDefault() {
        const row = await this.ensureSettingsRow();
        return this.effectivePolicy(row.defaultPolicy);
    }
    effectivePolicy(policy) {
        if (policy === client_1.BackupStoragePolicy.local_only)
            return policy;
        if (!this.backupConfig.gdriveEnabled)
            return client_1.BackupStoragePolicy.local_only;
        return policy;
    }
    shouldSyncToDrive(policy) {
        return policy === client_1.BackupStoragePolicy.drive_only || policy === client_1.BackupStoragePolicy.local_and_drive;
    }
    shouldRetainLocal(policy) {
        return policy === client_1.BackupStoragePolicy.local_only || policy === client_1.BackupStoragePolicy.local_and_drive;
    }
    async ensureSettingsRow() {
        const existing = await this.prisma.backupStorageSettings.findUnique({
            where: { id: backup_bootstrap_constants_1.STORAGE_SETTINGS_ID },
        });
        if (existing)
            return existing;
        return this.prisma.backupStorageSettings.create({
            data: {
                id: backup_bootstrap_constants_1.STORAGE_SETTINGS_ID,
                defaultPolicy: this.backupConfig.defaultStoragePolicy,
            },
        });
    }
    async assertDrivePolicyAllowed(policy) {
        if (policy === client_1.BackupStoragePolicy.local_only)
            return;
        if (!this.backupConfig.gdriveEnabled) {
            throw new common_1.BadRequestException('Drive storage policies require BACKUP_GDRIVE_ENABLED=true and a connected Google Drive account.');
        }
        const connected = await this.driveIntegration.isConnected();
        if (!connected) {
            throw new common_1.BadRequestException('Drive storage policies require a connected Google Drive account.');
        }
    }
};
exports.BackupStoragePolicyService = BackupStoragePolicyService;
exports.BackupStoragePolicyService = BackupStoragePolicyService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        backup_config_1.BackupConfig,
        audit_log_service_1.AuditLogService,
        backup_drive_integration_service_1.BackupDriveIntegrationService])
], BackupStoragePolicyService);
//# sourceMappingURL=backup-storage-policy.service.js.map