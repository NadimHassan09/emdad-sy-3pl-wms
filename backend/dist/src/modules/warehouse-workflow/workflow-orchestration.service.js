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
exports.WorkflowOrchestrationService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const task_sla_defaults_1 = require("./task-sla-defaults");
let WorkflowOrchestrationService = class WorkflowOrchestrationService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async onTaskCompleted(tx, task, body, actorUserId) {
        const wf = task.workflowInstance;
        if (wf.referenceType === 'inbound_order') {
            await this.afterInboundTask(tx, wf, task.taskType, body, actorUserId);
            await this.maybeCloseInboundWorkflow(tx, wf.id);
            return;
        }
        if (wf.referenceType === 'outbound_order') {
            await this.afterOutboundTask(tx, wf, task.taskType, body);
        }
    }
    async resolveStagingLotIdForPutaway(tx, args) {
        const { companyId, productId, stagingLocationId, qty, trackingType } = args;
        if (trackingType !== client_1.ProductTrackingType.lot) {
            return null;
        }
        const rows = await tx.currentStock.findMany({
            where: {
                companyId,
                productId,
                locationId: stagingLocationId,
                packageId: null,
                lotId: { not: null },
                quantityAvailable: { gt: 0 },
            },
            select: { lotId: true, quantityAvailable: true },
            orderBy: { quantityAvailable: 'desc' },
        });
        const covering = rows.find((r) => new client_1.Prisma.Decimal(r.quantityAvailable.toString()).greaterThanOrEqualTo(qty));
        if (!covering?.lotId) {
            throw new common_1.BadRequestException('Cannot prepare putaway: no staged lot line has enough available quantity for this inbound line. If stock is split across lots at staging, adjust inventory or receive again.');
        }
        return covering.lotId;
    }
    async nextNodeSequence(tx, instanceId) {
        const agg = await tx.workflowNode.aggregate({
            where: { instanceId },
            _max: { sequence: true },
        });
        return (agg._max.sequence ?? 0) + 1;
    }
    async countOpenTasks(tx, instanceId) {
        return tx.warehouseTask.count({
            where: {
                workflowInstanceId: instanceId,
                status: { notIn: ['completed', 'cancelled', 'failed'] },
            },
        });
    }
    async spawnPutawayFromFullReceive(tx, wf) {
        const orderId = wf.referenceId;
        const recvTask = await tx.warehouseTask.findFirst({
            where: {
                workflowInstanceId: wf.id,
                taskType: client_1.WarehouseTaskType.receiving,
                status: client_1.WarehouseTaskStatus.completed,
            },
            orderBy: { completedAt: 'desc' },
        });
        if (!recvTask)
            throw new common_1.BadRequestException('Missing completed receiving task.');
        const recvPayload = recvTask.payload;
        const stagingMap = new Map(recvPayload.lines.map((l) => [l.inbound_order_line_id, l.staging_location_id]));
        const order = await tx.inboundOrder.findUnique({
            where: { id: orderId },
            include: { lines: { orderBy: { lineNumber: 'asc' }, include: { product: true } } },
        });
        if (!order || order.companyId !== wf.companyId)
            throw new common_1.BadRequestException('Inbound order invalid.');
        const putLines = [];
        for (const l of order.lines) {
            if (l.receivedQuantity.lessThanOrEqualTo(0))
                continue;
            const sid = stagingMap.get(l.id);
            if (!sid)
                throw new common_1.BadRequestException(`Missing staging for line ${l.id} on skip-qc putaway.`);
            const lotId = await this.resolveStagingLotIdForPutaway(tx, {
                companyId: order.companyId,
                productId: l.productId,
                stagingLocationId: sid,
                qty: l.receivedQuantity,
                trackingType: l.product.trackingType,
            });
            putLines.push({
                inbound_order_line_id: l.id,
                product_id: l.productId,
                quantity: l.receivedQuantity.toString(),
                lot_id: lotId,
                source_staging_location_id: sid,
            });
        }
        if (putLines.length === 0)
            return;
        await this.insertPutawayTask(tx, wf.id, orderId, client_1.WarehouseTaskType.putaway, putLines, {});
    }
    async afterInboundTask(tx, wf, taskType, body, actorUserId) {
        switch (taskType) {
            case client_1.WarehouseTaskType.receiving:
                await this.afterReceiving(tx, wf);
                break;
            case client_1.WarehouseTaskType.qc:
                if (body.task_type === 'qc') {
                    await this.afterQc(tx, wf, body, actorUserId);
                }
                break;
            default:
                break;
        }
    }
    async afterReceiving(tx, wf) {
        await this.spawnPutawayFromFullReceive(tx, wf);
    }
    async afterQc(tx, wf, body, actorUserId) {
        const orderId = wf.referenceId;
        const order = await tx.inboundOrder.findUnique({
            where: { id: orderId },
            include: { lines: { orderBy: { lineNumber: 'asc' }, include: { product: true } } },
        });
        if (!order)
            throw new common_1.BadRequestException('Inbound order not found.');
        const recvTask = await tx.warehouseTask.findFirst({
            where: {
                workflowInstanceId: wf.id,
                taskType: client_1.WarehouseTaskType.receiving,
                status: client_1.WarehouseTaskStatus.completed,
            },
            orderBy: { completedAt: 'desc' },
        });
        if (!recvTask)
            throw new common_1.BadRequestException('Missing receiving task for putaway spawn.');
        const recvPayload = recvTask.payload;
        const stagingMap = new Map(recvPayload.lines.map((l) => [l.inbound_order_line_id, l.staging_location_id]));
        const sellable = [];
        const quarantine = [];
        for (const row of body.lines) {
            const line = order.lines.find((l) => l.id === row.inbound_order_line_id);
            if (!line)
                throw new common_1.BadRequestException(`Unknown inbound line ${row.inbound_order_line_id}`);
            const eligible = line.receivedQuantity;
            const passed = new client_1.Prisma.Decimal(String(row.passed_qty));
            const failed = new client_1.Prisma.Decimal(String(row.failed_qty));
            if (!passed.plus(failed).equals(eligible)) {
                throw new common_1.BadRequestException(`QC quantities must sum to received qty for line ${line.id} (expected ${eligible.toString()}).`);
            }
            const sid = stagingMap.get(line.id);
            if (!sid)
                throw new common_1.BadRequestException(`Missing staging for line ${line.id}.`);
            if (passed.greaterThan(0)) {
                const lotIdPassed = await this.resolveStagingLotIdForPutaway(tx, {
                    companyId: order.companyId,
                    productId: line.productId,
                    stagingLocationId: sid,
                    qty: passed,
                    trackingType: line.product.trackingType,
                });
                sellable.push({
                    inbound_order_line_id: line.id,
                    product_id: line.productId,
                    quantity: passed.toString(),
                    lot_id: lotIdPassed,
                    source_staging_location_id: sid,
                });
            }
            if (failed.greaterThan(0)) {
                const lotIdFailed = await this.resolveStagingLotIdForPutaway(tx, {
                    companyId: order.companyId,
                    productId: line.productId,
                    stagingLocationId: sid,
                    qty: failed,
                    trackingType: line.product.trackingType,
                });
                quarantine.push({
                    inbound_order_line_id: line.id,
                    product_id: line.productId,
                    quantity: failed.toString(),
                    lot_id: lotIdFailed,
                    source_staging_location_id: sid,
                });
            }
        }
        if (sellable.length > 0) {
            await this.insertPutawayTask(tx, wf.id, orderId, client_1.WarehouseTaskType.putaway, sellable, {});
        }
        if (quarantine.length > 0) {
            await this.insertPutawayTask(tx, wf.id, orderId, client_1.WarehouseTaskType.putaway_quarantine, quarantine, {});
        }
    }
    async insertPutawayTask(tx, instanceId, inboundOrderId, taskType, lines, extraPayload) {
        const seq = await this.nextNodeSequence(tx, instanceId);
        const node = await tx.workflowNode.create({
            data: {
                instanceId,
                stepKind: client_1.WorkflowStepKind.putaway,
                sequence: seq,
                status: 'pending',
            },
        });
        const putPayload = {
            inbound_order_id: inboundOrderId,
            lines,
            ...extraPayload,
        };
        await tx.warehouseTask.create({
            data: {
                workflowInstanceId: instanceId,
                workflowNodeId: node.id,
                taskType,
                status: client_1.WarehouseTaskStatus.pending,
                slaMinutes: (0, task_sla_defaults_1.defaultSlaMinutesForTaskType)(taskType),
                payload: putPayload,
            },
        });
    }
    async maybeCloseInboundWorkflow(tx, instanceId) {
        const wf = await tx.workflowInstance.findUnique({
            where: { id: instanceId },
        });
        if (!wf || wf.referenceType !== 'inbound_order')
            return;
        const open = await this.countOpenTasks(tx, instanceId);
        if (open > 0)
            return;
        const inboundOrderId = wf.referenceId;
        await tx.workflowInstance.update({
            where: { id: instanceId },
            data: { status: 'completed' },
        });
        await tx.inboundOrder.update({
            where: { id: inboundOrderId },
            data: {
                status: 'completed',
                completedAt: new Date(),
            },
        });
    }
    async afterOutboundTask(tx, wf, taskType, body) {
        const orderId = wf.referenceId;
        switch (taskType) {
            case client_1.WarehouseTaskType.pick:
                if (body.task_type === 'pick') {
                    await this.spawnPackIfNeeded(tx, wf.id, orderId);
                }
                break;
            case client_1.WarehouseTaskType.pack:
                if (body.task_type === 'pack') {
                    await this.enqueueDispatchTaskIfNeeded(tx, wf.id, orderId);
                }
                break;
            case client_1.WarehouseTaskType.dispatch:
                if (body.task_type === 'dispatch') {
                    await tx.workflowInstance.update({
                        where: { id: wf.id },
                        data: { status: 'completed' },
                    });
                }
                break;
            default:
                break;
        }
    }
    async spawnPackIfNeeded(tx, instanceId, orderId) {
        const existing = await tx.warehouseTask.findFirst({
            where: {
                workflowInstanceId: instanceId,
                taskType: client_1.WarehouseTaskType.pack,
            },
            orderBy: { createdAt: 'desc' },
        });
        if (existing &&
            [client_1.WarehouseTaskStatus.pending, client_1.WarehouseTaskStatus.assigned, client_1.WarehouseTaskStatus.in_progress].includes(existing.status)) {
            return;
        }
        if (existing?.status === client_1.WarehouseTaskStatus.completed) {
            return;
        }
        const order = await tx.outboundOrder.findUnique({
            where: { id: orderId },
            include: { lines: { orderBy: { lineNumber: 'asc' } } },
        });
        if (!order)
            throw new common_1.BadRequestException('Outbound order missing for pack spawn.');
        const seq = await this.nextNodeSequence(tx, instanceId);
        const node = await tx.workflowNode.create({
            data: {
                instanceId,
                stepKind: client_1.WorkflowStepKind.pack,
                sequence: seq,
                status: 'pending',
            },
        });
        await tx.warehouseTask.create({
            data: {
                workflowInstanceId: instanceId,
                workflowNodeId: node.id,
                taskType: client_1.WarehouseTaskType.pack,
                status: client_1.WarehouseTaskStatus.pending,
                slaMinutes: (0, task_sla_defaults_1.defaultSlaMinutesForTaskType)(client_1.WarehouseTaskType.pack),
                payload: {
                    outbound_order_id: orderId,
                    outbound_order_line_ids: order.lines.map((l) => l.id),
                },
            },
        });
    }
    async enqueueDispatchTaskIfNeeded(tx, instanceId, orderId) {
        const existing = await tx.warehouseTask.findFirst({
            where: {
                workflowInstanceId: instanceId,
                taskType: client_1.WarehouseTaskType.dispatch,
            },
            orderBy: { createdAt: 'desc' },
        });
        if (existing &&
            [client_1.WarehouseTaskStatus.pending, client_1.WarehouseTaskStatus.assigned, client_1.WarehouseTaskStatus.in_progress].includes(existing.status)) {
            return;
        }
        if (existing?.status === client_1.WarehouseTaskStatus.completed) {
            return;
        }
        const seq = await this.nextNodeSequence(tx, instanceId);
        const node = await tx.workflowNode.create({
            data: {
                instanceId,
                stepKind: client_1.WorkflowStepKind.dispatch,
                sequence: seq,
                status: 'pending',
            },
        });
        await tx.warehouseTask.create({
            data: {
                workflowInstanceId: instanceId,
                workflowNodeId: node.id,
                taskType: client_1.WarehouseTaskType.dispatch,
                status: client_1.WarehouseTaskStatus.pending,
                slaMinutes: (0, task_sla_defaults_1.defaultSlaMinutesForTaskType)(client_1.WarehouseTaskType.dispatch),
                payload: { outbound_order_id: orderId },
            },
        });
    }
};
exports.WorkflowOrchestrationService = WorkflowOrchestrationService;
exports.WorkflowOrchestrationService = WorkflowOrchestrationService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], WorkflowOrchestrationService);
//# sourceMappingURL=workflow-orchestration.service.js.map