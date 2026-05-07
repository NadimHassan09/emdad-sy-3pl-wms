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
const prisma_service_1 = require("../../common/prisma/prisma.service");
const ESCALATION_COOLDOWN_MS = 60 * 60 * 1000;
let SlaEscalationService = SlaEscalationService_1 = class SlaEscalationService {
    prisma;
    log = new common_1.Logger(SlaEscalationService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    async tick() {
        try {
            const candidates = await this.prisma.warehouseTask.findMany({
                where: {
                    status: client_1.WarehouseTaskStatus.in_progress,
                    slaMinutes: { not: null },
                    startedAt: { not: null },
                    escalationLevel: { lt: 20 },
                },
                select: { id: true, startedAt: true, slaMinutes: true, escalationLevel: true },
            });
            const now = Date.now();
            for (const t of candidates) {
                const slaMin = t.slaMinutes;
                const started = t.startedAt.getTime();
                const breachedAtTs = started + slaMin * 60_000;
                if (now <= breachedAtTs)
                    continue;
                const lastEsc = await this.prisma.taskEvent.findFirst({
                    where: { taskId: t.id, event: 'sla_escalation' },
                    orderBy: { createdAt: 'desc' },
                });
                if (lastEsc && now - lastEsc.createdAt.getTime() < ESCALATION_COOLDOWN_MS)
                    continue;
                await this.prisma.$transaction(async (tx) => {
                    const locked = await tx.warehouseTask.findUnique({ where: { id: t.id } });
                    if (!locked?.startedAt || locked.slaMinutes == null)
                        return;
                    const innerNow = Date.now();
                    const breachDeadline = locked.startedAt.getTime() + locked.slaMinutes * 60_000;
                    if (innerNow <= breachDeadline)
                        return;
                    const lastInner = await tx.taskEvent.findFirst({
                        where: { taskId: t.id, event: 'sla_escalation' },
                        orderBy: { createdAt: 'desc' },
                    });
                    if (lastInner && innerNow - lastInner.createdAt.getTime() < ESCALATION_COOLDOWN_MS)
                        return;
                    const next = locked.escalationLevel + 1;
                    await tx.warehouseTask.update({
                        where: { id: t.id },
                        data: { escalationLevel: next },
                    });
                    await tx.taskEvent.create({
                        data: {
                            taskId: t.id,
                            event: 'sla_escalation',
                            payload: {
                                escalationLevel: next,
                                breachedAtTs: breachDeadline,
                            },
                        },
                    });
                    this.log.debug(`[sla_notify_stub] task=${t.id} escalation=${next}`);
                    const wfTask = await tx.warehouseTask.findUnique({
                        where: { id: t.id },
                        select: { workflowInstanceId: true },
                    });
                    if (wfTask?.workflowInstanceId) {
                        const inst = await tx.workflowInstance.findUnique({
                            where: { id: wfTask.workflowInstanceId },
                        });
                        if (inst &&
                            inst.status !== client_1.WorkflowInstanceStatus.completed &&
                            inst.status !== client_1.WorkflowInstanceStatus.cancelled &&
                            inst.status !== client_1.WorkflowInstanceStatus.degraded) {
                            await tx.workflowInstance.update({
                                where: { id: inst.id },
                                data: { status: client_1.WorkflowInstanceStatus.degraded },
                            });
                        }
                    }
                });
            }
        }
        catch (e) {
            this.log.warn(`sla tick failed: ${e instanceof Error ? e.message : String(e)}`);
        }
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
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SlaEscalationService);
//# sourceMappingURL=sla-escalation.service.js.map