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
var BackupSchedulerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackupSchedulerService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const client_1 = require("@prisma/client");
const audit_log_service_1 = require("../../common/audit/audit-log.service");
const cron_leader_service_1 = require("../../common/cron/cron-leader.service");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const backup_config_1 = require("./backup-config");
const backup_operations_service_1 = require("./backup-operations.service");
const backup_runner_service_1 = require("./backup-runner.service");
const backup_schedule_util_1 = require("./backup-schedule.util");
const backup_storage_policy_service_1 = require("./backup-storage-policy.service");
let BackupSchedulerService = BackupSchedulerService_1 = class BackupSchedulerService {
    prisma;
    backupConfig;
    operations;
    runner;
    audit;
    storagePolicy;
    cronLeader;
    logger = new common_1.Logger(BackupSchedulerService_1.name);
    systemPrincipal = null;
    scheduledRunInFlight = false;
    constructor(prisma, backupConfig, operations, runner, audit, storagePolicy, cronLeader) {
        this.prisma = prisma;
        this.backupConfig = backupConfig;
        this.operations = operations;
        this.runner = runner;
        this.audit = audit;
        this.storagePolicy = storagePolicy;
        this.cronLeader = cronLeader;
    }
    async onModuleInit() {
        await this.resolveSystemPrincipal();
    }
    async tick() {
        await this.cronLeader.runExclusive('backup-scheduler', 90, () => this.runTick());
    }
    async runTick() {
        if (!this.backupConfig.enabled || !this.backupConfig.schedulerEnabled) {
            return;
        }
        if (this.scheduledRunInFlight) {
            return;
        }
        if (this.operations.isBusy() || this.runner.isBusy()) {
            this.logger.debug('Skipping scheduled backup tick — another operation is active.');
            return;
        }
        const runningScheduled = await this.prisma.backupJob.findFirst({
            where: {
                type: client_1.BackupJobType.scheduled,
                status: { in: [client_1.BackupJobStatus.pending, client_1.BackupJobStatus.running] },
            },
        });
        if (runningScheduled) {
            return;
        }
        const principal = await this.resolveSystemPrincipal();
        if (!principal) {
            this.logger.warn('Skipping scheduled backup — no active super_admin system user.');
            return;
        }
        const now = new Date();
        const schedules = await this.prisma.backupSchedule.findMany({
            where: { enabled: true },
            orderBy: { createdAt: 'asc' },
        });
        const due = schedules.filter((s) => (0, backup_schedule_util_1.isBackupScheduleDue)(s, now));
        if (due.length === 0)
            return;
        const schedule = due[0];
        this.scheduledRunInFlight = true;
        try {
            await this.executeSchedule(schedule.id, principal);
        }
        catch (err) {
            this.logger.error(`Scheduled backup failed schedule=${schedule.id}: ${err instanceof Error ? err.message : String(err)}`);
        }
        finally {
            this.scheduledRunInFlight = false;
        }
        if (due.length > 1) {
            this.logger.warn(`Skipped ${due.length - 1} additional due schedule(s) — only one scheduled backup at a time.`);
        }
    }
    async runScheduleNow(scheduleId, principal) {
        if (this.operations.isBusy() || this.runner.isBusy()) {
            throw new Error('Another backup operation is already running.');
        }
        if (this.scheduledRunInFlight) {
            throw new Error('A scheduled backup is already in progress.');
        }
        this.scheduledRunInFlight = true;
        try {
            return await this.executeSchedule(scheduleId, principal);
        }
        finally {
            this.scheduledRunInFlight = false;
        }
    }
    async executeSchedule(scheduleId, principal) {
        const schedule = await this.prisma.backupSchedule.findUnique({ where: { id: scheduleId } });
        if (!schedule)
            throw new Error('Backup schedule not found.');
        const label = `scheduled:${schedule.frequency}@${String(schedule.hour).padStart(2, '0')}:${String(schedule.minute).padStart(2, '0')}`;
        const resolvedPolicy = await this.storagePolicy.resolveForSchedule(schedule.storagePolicy);
        const job = await this.prisma.backupJob.create({
            data: {
                type: client_1.BackupJobType.scheduled,
                status: client_1.BackupJobStatus.pending,
                label,
                triggeredByUserId: principal.id,
                backupScheduleId: scheduleId,
                storagePolicy: resolvedPolicy,
                progressPercent: 0,
            },
        });
        await this.prisma.backupSchedule.update({
            where: { id: scheduleId },
            data: { lastRunAt: new Date() },
        });
        try {
            await this.runner.runScheduledBackup(job.id, principal, scheduleId);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            await this.audit.logBestEffort(this.audit.fromPrincipal(principal, {
                action: 'backup.schedule.failed',
                resourceType: 'backup_schedule',
                resourceId: scheduleId,
                newState: {
                    message: `Scheduled backup failed for schedule ${scheduleId}`,
                    jobId: job.id,
                    error: message,
                },
            }));
            throw err;
        }
        return { jobId: job.id };
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
exports.BackupSchedulerService = BackupSchedulerService;
__decorate([
    (0, schedule_1.Cron)('* * * * *'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], BackupSchedulerService.prototype, "tick", null);
exports.BackupSchedulerService = BackupSchedulerService = BackupSchedulerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        backup_config_1.BackupConfig,
        backup_operations_service_1.BackupOperationsService,
        backup_runner_service_1.BackupRunnerService,
        audit_log_service_1.AuditLogService,
        backup_storage_policy_service_1.BackupStoragePolicyService,
        cron_leader_service_1.CronLeaderService])
], BackupSchedulerService);
//# sourceMappingURL=backup-scheduler.service.js.map