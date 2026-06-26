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
var BackupDriveRetryService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackupDriveRetryService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const client_1 = require("@prisma/client");
const cron_leader_service_1 = require("../../common/cron/cron-leader.service");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const backup_config_1 = require("./backup-config");
const backup_drive_sync_service_1 = require("./backup-drive-sync.service");
let BackupDriveRetryService = BackupDriveRetryService_1 = class BackupDriveRetryService {
    prisma;
    backupConfig;
    driveSync;
    cronLeader;
    logger = new common_1.Logger(BackupDriveRetryService_1.name);
    retryInFlight = false;
    systemPrincipal = null;
    constructor(prisma, backupConfig, driveSync, cronLeader) {
        this.prisma = prisma;
        this.backupConfig = backupConfig;
        this.driveSync = driveSync;
        this.cronLeader = cronLeader;
    }
    async processRetries() {
        await this.cronLeader.runExclusive('backup-drive-retry', 150, () => this.runProcessRetries());
    }
    async runProcessRetries() {
        if (!this.backupConfig.enabled || !this.backupConfig.gdriveEnabled)
            return;
        if (this.retryInFlight)
            return;
        const principal = await this.resolveSystemPrincipal();
        if (!principal) {
            this.logger.warn('Skipping drive upload retries — no active super_admin system user.');
            return;
        }
        const now = new Date();
        const candidates = await this.prisma.backupJob.findMany({
            where: {
                status: 'completed',
                gdriveSyncStatus: client_1.BackupDriveSyncStatus.failed,
                gdriveNextRetryAt: { lte: now },
                gdriveSyncAttempts: { lt: this.backupConfig.gdriveRetryMaxAttempts },
            },
            orderBy: { gdriveNextRetryAt: 'asc' },
            take: 3,
            select: { id: true },
        });
        if (candidates.length === 0)
            return;
        this.retryInFlight = true;
        try {
            for (const job of candidates) {
                try {
                    await this.driveSync.syncJob(job.id, principal, { isRetry: true });
                }
                catch (err) {
                    this.logger.warn(`Drive retry failed for ${job.id}: ${err instanceof Error ? err.message : String(err)}`);
                }
            }
        }
        finally {
            this.retryInFlight = false;
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
exports.BackupDriveRetryService = BackupDriveRetryService;
__decorate([
    (0, schedule_1.Cron)('*/2 * * * *'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], BackupDriveRetryService.prototype, "processRetries", null);
exports.BackupDriveRetryService = BackupDriveRetryService = BackupDriveRetryService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        backup_config_1.BackupConfig,
        backup_drive_sync_service_1.BackupDriveSyncService,
        cron_leader_service_1.CronLeaderService])
], BackupDriveRetryService);
//# sourceMappingURL=backup-drive-retry.service.js.map