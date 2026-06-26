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
var SlaEscalationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SlaEscalationService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const client_1 = require("@prisma/client");
const cron_leader_service_1 = require("../../common/cron/cron-leader.service");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const notifications_service_1 = require("../notifications/notifications.service");
const sla_audit_service_1 = require("./sla-audit.service");
const sla_breach_util_1 = require("./sla-breach.util");
let SlaEscalationService = SlaEscalationService_1 = class SlaEscalationService {
    prisma;
    cronLeader;
    notifications;
    slaAudit;
    log = new common_1.Logger(SlaEscalationService_1.name);
    constructor(prisma, cronLeader, notifications, slaAudit) {
        this.prisma = prisma;
        this.cronLeader = cronLeader;
        this.notifications = notifications;
        this.slaAudit = slaAudit;
    }
    async tick() {
        await this.cronLeader.runExclusive('sla-escalation', 360, () => this.runTick());
    }
    async runTick() {
        let escalated = 0;
        try {
            const candidates = await this.prisma.warehouseTask.findMany({
                where: {
                    status: client_1.WarehouseTaskStatus.in_progress,
                    slaMinutes: { not: null },
                    startedAt: { not: null },
                    escalationLevel: { lt: 20 },
                },
                select: {
                    id: true,
                    startedAt: true,
                    slaMinutes: true,
                    escalationLevel: true,
                    taskType: true,
                    workflowInstanceId: true,
                    workflowInstance: {
                        select: {
                            id: true,
                            companyId: true,
                            status: true,
                            company: { select: { name: true } },
                            warehouse: { select: { name: true, code: true } },
                        },
                    },
                },
            });
            const now = Date.now();
            for (const task of candidates) {
                if (!(0, sla_breach_util_1.isTaskSlaBreached)(task, now))
                    continue;
                const lastEsc = await this.prisma.taskEvent.findFirst({
                    where: { taskId: task.id, event: 'sla_escalation' },
                    orderBy: { createdAt: 'desc' },
                });
                if (lastEsc && now - lastEsc.createdAt.getTime() < sla_breach_util_1.SLA_ESCALATION_COOLDOWN_MS)
                    continue;
                const outcome = await this.escalateTask(task.id);
                if (!outcome)
                    continue;
                const notified = await this.notifications.notifyManagersSlaBreach({
                    taskId: outcome.taskId,
                    taskTypeLabel: outcome.taskTypeLabel,
                    escalationLevel: outcome.escalationLevel,
                    slaMinutes: outcome.slaMinutes,
                    overdueMinutes: (0, sla_breach_util_1.slaOverdueMinutes)(task.startedAt, task.slaMinutes, now),
                    companyName: outcome.companyName,
                    warehouseName: outcome.warehouseName,
                });
                await this.slaAudit.escalated({
                    companyId: outcome.companyId,
                    taskId: outcome.taskId,
                    previousLevel: outcome.previousLevel,
                    escalationLevel: outcome.escalationLevel,
                    slaMinutes: outcome.slaMinutes,
                    breachedAt: outcome.breachedAt,
                    notifiedManagers: notified,
                    workflowInstanceId: outcome.workflowInstanceId,
                });
                if (notified > 0) {
                    this.log.log(`SLA breach task=${outcome.taskId} level=${outcome.escalationLevel} notified=${notified} manager(s)`);
                }
                else {
                    this.log.warn(`SLA breach task=${outcome.taskId} level=${outcome.escalationLevel} — escalation recorded, no new manager notifications`);
                }
                escalated += 1;
            }
        }
        catch (e) {
            this.log.warn(`sla tick failed: ${e instanceof Error ? e.message : String(e)}`);
        }
        return escalated;
    }
    async escalateTask(taskId) {
        return this.prisma.$transaction(async (tx) => {
            const locked = await tx.warehouseTask.findUnique({
                where: { id: taskId },
                select: {
                    id: true,
                    startedAt: true,
                    slaMinutes: true,
                    escalationLevel: true,
                    taskType: true,
                    workflowInstanceId: true,
                    workflowInstance: {
                        select: {
                            id: true,
                            companyId: true,
                            status: true,
                            company: { select: { name: true } },
                            warehouse: { select: { name: true, code: true } },
                        },
                    },
                },
            });
            if (!locked?.startedAt || locked.slaMinutes == null)
                return null;
            const innerNow = Date.now();
            if (!(0, sla_breach_util_1.isTaskSlaBreached)(locked, innerNow))
                return null;
            const lastInner = await tx.taskEvent.findFirst({
                where: { taskId: locked.id, event: 'sla_escalation' },
                orderBy: { createdAt: 'desc' },
            });
            if (lastInner && innerNow - lastInner.createdAt.getTime() < sla_breach_util_1.SLA_ESCALATION_COOLDOWN_MS) {
                return null;
            }
            const previousLevel = locked.escalationLevel;
            const next = previousLevel + 1;
            const breachedAt = new Date((0, sla_breach_util_1.slaBreachDeadlineMs)(locked.startedAt, locked.slaMinutes));
            await tx.warehouseTask.update({
                where: { id: locked.id },
                data: { escalationLevel: next },
            });
            await tx.taskEvent.create({
                data: {
                    taskId: locked.id,
                    event: 'sla_escalation',
                    payload: {
                        escalationLevel: next,
                        breachedAtTs: breachedAt.getTime(),
                        previousLevel,
                    },
                },
            });
            const wf = locked.workflowInstance;
            if (wf &&
                wf.status !== client_1.WorkflowInstanceStatus.completed &&
                wf.status !== client_1.WorkflowInstanceStatus.cancelled &&
                wf.status !== client_1.WorkflowInstanceStatus.degraded) {
                await tx.workflowInstance.update({
                    where: { id: wf.id },
                    data: { status: client_1.WorkflowInstanceStatus.degraded },
                });
            }
            const warehouseName = wf?.warehouse.name ?? wf?.warehouse.code ?? 'Warehouse';
            const companyName = wf?.company.name ?? 'Client';
            return {
                taskId: locked.id,
                companyId: wf?.companyId ?? '',
                workflowInstanceId: locked.workflowInstanceId,
                taskTypeLabel: (0, sla_breach_util_1.slaTaskTypeLabel)(locked.taskType),
                escalationLevel: next,
                previousLevel,
                slaMinutes: locked.slaMinutes,
                breachedAt,
                companyName,
                warehouseName,
            };
        });
    }
};
exports.SlaEscalationService = SlaEscalationService;
__decorate([
    (0, schedule_1.Cron)('*/5 * * * *'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SlaEscalationService.prototype, "tick", null);
exports.SlaEscalationService = SlaEscalationService = SlaEscalationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        cron_leader_service_1.CronLeaderService,
        notifications_service_1.NotificationsService,
        sla_audit_service_1.SlaAuditService])
], SlaEscalationService);
//# sourceMappingURL=sla-escalation.service.js.map