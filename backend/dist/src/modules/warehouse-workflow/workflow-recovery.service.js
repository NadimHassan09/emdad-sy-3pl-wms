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
exports.WorkflowRecoveryService = void 0;
const common_1 = require("@nestjs/common");
const cache_invalidation_service_1 = require("../../common/redis/cache-invalidation.service");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const compensation_1 = require("../../vendor/wms-task-execution/compensation");
const task_inventory_effects_service_1 = require("./task-inventory-effects.service");
function isRecord(v) {
    return !!v && typeof v === 'object' && !Array.isArray(v);
}
function reservationRowsFromExec(raw) {
    if (!isRecord(raw))
        return [];
    const r = raw.reservations;
    return Array.isArray(r) ? r : [];
}
let WorkflowRecoveryService = class WorkflowRecoveryService {
    prisma;
    effects;
    cacheInv;
    constructor(prisma, effects, cacheInv) {
        this.prisma = prisma;
        this.effects = effects;
        this.cacheInv = cacheInv;
    }
    async recoverWorkflowInstance(instanceId, user, rawBody) {
        if (!user.companyId)
            throw new common_1.BadRequestException('companyId required.');
        const parsed = compensation_1.workflowRecoverRequestSchema.safeParse(rawBody);
        if (!parsed.success) {
            throw new common_1.BadRequestException({
                code: 'WORKFLOW_RECOVER_VALIDATION',
                issues: parsed.error.issues,
            });
        }
        const dryRun = parsed.data.dry_run ?? false;
        const wf = await this.prisma.workflowInstance.findUnique({
            where: { id: instanceId },
        });
        if (!wf || wf.companyId !== user.companyId)
            throw new common_1.NotFoundException('Workflow instance not found.');
        if (!['super_admin', 'wh_manager'].includes(user.role)) {
            throw new common_1.ForbiddenException('Only warehouse managers may run workflow recovery.');
        }
        const preview = [];
        for (const action of parsed.data.actions) {
            switch (action.code) {
                case 'RELEASE_RESERVATIONS_OUTBOUND': {
                    const task = await this.prisma.warehouseTask.findUnique({
                        where: { id: action.task_id },
                    });
                    if (!task || task.workflowInstanceId !== instanceId) {
                        throw new common_1.BadRequestException(`Invalid RELEASE task ${action.task_id} for workflow.`);
                    }
                    const rows = reservationRowsFromExec(task.executionState);
                    preview.push({
                        code: action.code,
                        task_id: action.task_id,
                        effect: rows.length === 0 ? 'no_reservations_snapshot' : `release_${rows.length}_rows`,
                    });
                    break;
                }
                case 'MARK_DAMAGED_QTY': {
                    const task = await this.prisma.warehouseTask.findUnique({
                        where: { id: action.task_id },
                    });
                    if (!task || task.workflowInstanceId !== instanceId) {
                        throw new common_1.BadRequestException(`Invalid MARK_DAMAGED task ${action.task_id} for workflow.`);
                    }
                    preview.push({
                        code: action.code,
                        task_id: action.task_id,
                        effect: dryRun ? 'dry_run_audit_only' : `audit_qty_${action.qty}`,
                    });
                    break;
                }
                default:
                    break;
            }
        }
        if (dryRun) {
            return { dryRun: true, instanceId, preview };
        }
        await this.prisma.$transaction(async (tx) => {
            for (const action of parsed.data.actions) {
                if (action.code === 'RELEASE_RESERVATIONS_OUTBOUND') {
                    const task = await tx.warehouseTask.findUniqueOrThrow({ where: { id: action.task_id } });
                    const rows = reservationRowsFromExec(task.executionState);
                    if (rows.length > 0) {
                        await this.effects.releaseReservations(tx, rows);
                    }
                    await tx.taskEvent.create({
                        data: {
                            taskId: action.task_id,
                            event: 'compensation_recovery',
                            actorId: user.id,
                            payload: { code: action.code, reservations: rows.length },
                        },
                    });
                }
                if (action.code === 'MARK_DAMAGED_QTY') {
                    await tx.taskEvent.create({
                        data: {
                            taskId: action.task_id,
                            event: 'compensation_recovery',
                            actorId: user.id,
                            payload: {
                                code: action.code,
                                inbound_order_line_id: action.inbound_order_line_id,
                                qty: action.qty,
                            },
                        },
                    });
                }
            }
        });
        await this.cacheInv.afterTaskAndStockMutation();
        return { dryRun: false, instanceId, preview };
    }
};
exports.WorkflowRecoveryService = WorkflowRecoveryService;
exports.WorkflowRecoveryService = WorkflowRecoveryService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        task_inventory_effects_service_1.TaskInventoryEffectsService,
        cache_invalidation_service_1.CacheInvalidationService])
], WorkflowRecoveryService);
//# sourceMappingURL=workflow-recovery.service.js.map