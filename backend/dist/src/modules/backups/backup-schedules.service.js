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
exports.BackupSchedulesService = void 0;
const common_1 = require("@nestjs/common");
const audit_log_service_1 = require("../../common/audit/audit-log.service");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const backup_scheduler_service_1 = require("./backup-scheduler.service");
const backup_storage_policy_service_1 = require("./backup-storage-policy.service");
let BackupSchedulesService = class BackupSchedulesService {
    prisma;
    audit;
    scheduler;
    storagePolicy;
    constructor(prisma, audit, scheduler, storagePolicy) {
        this.prisma = prisma;
        this.audit = audit;
        this.scheduler = scheduler;
        this.storagePolicy = storagePolicy;
    }
    async list() {
        const items = await this.prisma.backupSchedule.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                createdBy: { select: { id: true, email: true, fullName: true } },
                updatedBy: { select: { id: true, email: true, fullName: true } },
            },
        });
        return { items };
    }
    async findById(id) {
        const row = await this.prisma.backupSchedule.findUnique({
            where: { id },
            include: {
                createdBy: { select: { id: true, email: true, fullName: true } },
                updatedBy: { select: { id: true, email: true, fullName: true } },
            },
        });
        if (!row)
            throw new common_1.NotFoundException('Backup schedule not found.');
        return row;
    }
    async create(user, dto) {
        const resolvedPolicy = await this.storagePolicy.resolveForSchedule(dto.storagePolicy ?? null);
        const row = await this.prisma.backupSchedule.create({
            data: {
                enabled: dto.enabled ?? true,
                frequency: dto.frequency,
                hour: dto.hour,
                minute: dto.minute,
                retentionDays: dto.retentionDays,
                storagePolicy: dto.storagePolicy ?? null,
                createdByUserId: user.id,
                updatedByUserId: user.id,
            },
        });
        await this.audit.log(this.audit.fromPrincipal(user, {
            action: 'backup.schedule.created',
            resourceType: 'backup_schedule',
            resourceId: row.id,
            newState: {
                message: `${user.email ?? user.id} created backup schedule ${row.id}`,
                frequency: row.frequency,
                hour: row.hour,
                minute: row.minute,
                retentionDays: row.retentionDays,
                storagePolicy: row.storagePolicy,
                effectiveStoragePolicy: resolvedPolicy,
                enabled: row.enabled,
            },
        }));
        return { ...row, effectiveStoragePolicy: resolvedPolicy };
    }
    async update(user, id, dto) {
        const existing = await this.findById(id);
        if (dto.storagePolicy !== undefined) {
            await this.storagePolicy.resolveForSchedule(dto.storagePolicy);
        }
        const row = await this.prisma.backupSchedule.update({
            where: { id },
            data: {
                ...dto,
                updatedByUserId: user.id,
            },
        });
        await this.audit.log(this.audit.fromPrincipal(user, {
            action: 'backup.schedule.updated',
            resourceType: 'backup_schedule',
            resourceId: id,
            newState: {
                message: `${user.email ?? user.id} updated backup schedule ${id}`,
                ...dto,
            },
        }));
        const effectiveStoragePolicy = await this.storagePolicy.resolveForSchedule(row.storagePolicy ?? existing.storagePolicy ?? null);
        return { ...row, effectiveStoragePolicy };
    }
    async runNow(user, id) {
        await this.findById(id);
        return this.scheduler.runScheduleNow(id, user);
    }
};
exports.BackupSchedulesService = BackupSchedulesService;
exports.BackupSchedulesService = BackupSchedulesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        backup_scheduler_service_1.BackupSchedulerService,
        backup_storage_policy_service_1.BackupStoragePolicyService])
], BackupSchedulesService);
//# sourceMappingURL=backup-schedules.service.js.map