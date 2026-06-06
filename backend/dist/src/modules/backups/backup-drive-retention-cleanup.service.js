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
var BackupDriveRetentionCleanupService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackupDriveRetentionCleanupService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const backup_config_1 = require("./backup-config");
const backup_drive_retention_service_1 = require("./backup-drive-retention.service");
const backup_operations_service_1 = require("./backup-operations.service");
const backup_runner_service_1 = require("./backup-runner.service");
let BackupDriveRetentionCleanupService = BackupDriveRetentionCleanupService_1 = class BackupDriveRetentionCleanupService {
    prisma;
    backupConfig;
    operations;
    runner;
    driveRetention;
    logger = new common_1.Logger(BackupDriveRetentionCleanupService_1.name);
    cleanupInFlight = false;
    systemPrincipal = null;
    constructor(prisma, backupConfig, operations, runner, driveRetention) {
        this.prisma = prisma;
        this.backupConfig = backupConfig;
        this.operations = operations;
        this.runner = runner;
        this.driveRetention = driveRetention;
    }
    async runScheduledCleanup() {
        if (!this.backupConfig.enabled || !this.backupConfig.gdriveRetentionCleanupEnabled)
            return;
        if (!this.backupConfig.gdriveEnabled)
            return;
        if (this.cleanupInFlight)
            return;
        if (this.operations.isBusy() || this.runner.isBusy()) {
            this.logger.debug('Skipping drive retention cleanup — backup operation active.');
            return;
        }
        const principal = await this.resolveSystemPrincipal();
        if (!principal) {
            this.logger.warn('Skipping drive retention cleanup — no active super_admin system user.');
            return;
        }
        this.cleanupInFlight = true;
        try {
            await this.driveRetention.executeCleanup(principal);
        }
        catch (err) {
            this.logger.error(`Drive retention cleanup failed: ${err instanceof Error ? err.message : String(err)}`);
        }
        finally {
            this.cleanupInFlight = false;
        }
    }
    async resolveSystemPrincipal() {
        if (this.systemPrincipal)
            return this.systemPrincipal;
        const user = await this.prisma.user.findFirst({
            where: { role: client_1.UserRole.super_admin, status: 'active' },
            orderBy: { createdAt: 'asc' },
            select: { id: true, email: true, role: true, companyId: true },
        });
        if (!user)
            return null;
        this.systemPrincipal = {
            id: user.id,
            email: user.email,
            role: user.role,
            companyId: user.companyId,
            tenantScope: 'all',
            authorizedCompanyIds: [],
        };
        return this.systemPrincipal;
    }
};
exports.BackupDriveRetentionCleanupService = BackupDriveRetentionCleanupService;
__decorate([
    (0, schedule_1.Cron)('30 5 * * *'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], BackupDriveRetentionCleanupService.prototype, "runScheduledCleanup", null);
exports.BackupDriveRetentionCleanupService = BackupDriveRetentionCleanupService = BackupDriveRetentionCleanupService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        backup_config_1.BackupConfig,
        backup_operations_service_1.BackupOperationsService,
        backup_runner_service_1.BackupRunnerService,
        backup_drive_retention_service_1.BackupDriveRetentionService])
], BackupDriveRetentionCleanupService);
//# sourceMappingURL=backup-drive-retention-cleanup.service.js.map