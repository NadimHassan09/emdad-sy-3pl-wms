"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowEngineService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const domain_exceptions_1 = require("../../common/errors/domain-exceptions");
const task_sla_defaults_1 = require("./task-sla-defaults");
const DEF_INBOUND = 'inbound_default_v1';
const DEF_OUTBOUND = 'outbound_default_v1';
let WorkflowEngineService = class WorkflowEngineService {
    async createInboundInstanceWithFirstReceiveTask(tx, user, orderId, warehouseId, stagingOverrides) {
        if (!user.companyId)
            throw new common_1.BadRequestException('companyId required on user.');
        const order = await tx.inboundOrder.findUnique({
            where: { id: orderId },
            include: {
                lines: { orderBy: { lineNumber: 'asc' } },
            },
        });
        if (!order || order.companyId !== user.companyId) {
            throw new common_1.NotFoundException('Inbound order not found.');
        }
        if (!['confirmed', 'in_progress', 'partially_received'].includes(order.status)) {
            throw new domain_exceptions_1.InvalidStateException('Workflow can only start for an active inbound order.');
        }
        const existing = await tx.workflowInstance.findFirst({
            where: {
                referenceType: 'inbound_order',
                referenceId: orderId,
                status: { in: ['pending', 'in_progress', 'degraded'] },
            },
        });
        if (existing) {
            const tasks = await tx.warehouseTask.findMany({
                where: { workflowInstanceId: existing.id },
                orderBy: { id: 'asc' },
            });
            return { workflowInstance: existing, nodes: [], tasks };
        }
        const staging = stagingOverrides ?? {};
        const linesPayload = order.lines.map((l) => {
            const sid = staging[l.id];
            if (!sid) {
                throw new common_1.BadRequestException(`stagingOverrides must map every line id → staging_location_id (missing ${l.id}).`);
            }
            return {
                inbound_order_line_id: l.id,
                expected_qty: l.expectedQuantity.toString(),
                staging_location_id: sid,
            };
        });
        const wf = await tx.workflowInstance.create({
            data: {
                companyId: user.companyId,
                warehouseId,
                referenceType: 'inbound_order',
                referenceId: orderId,
                definitionCode: DEF_INBOUND,
                status: 'in_progress',
                metadata: { createdByUserId: user.id, stage: 'receiving' },
            },
        });
        const nRecv = await tx.workflowNode.create({
            data: {
                instanceId: wf.id,
                stepKind: client_1.WorkflowStepKind.receiving,
                sequence: 1,
                status: 'in_progress',
            },
        });
        const recvPayload = {
            inbound_order_id: orderId,
            lines: linesPayload,
        };
        await tx.warehouseTask.create({
            data: {
                workflowInstanceId: wf.id,
                workflowNodeId: nRecv.id,
                taskType: client_1.WarehouseTaskType.receiving,
                status: client_1.WarehouseTaskStatus.pending,
                slaMinutes: (0, task_sla_defaults_1.defaultSlaMinutesForTaskType)(client_1.WarehouseTaskType.receiving),
                payload: recvPayload,
            },
        });
        const tasks = await tx.warehouseTask.findMany({
            where: { workflowInstanceId: wf.id },
            orderBy: { id: 'asc' },
        });
        const nodes = await tx.workflowNode.findMany({
            where: { instanceId: wf.id },
            orderBy: { sequence: 'asc' },
        });
        return { workflowInstance: wf, nodes, tasks };
    }
    async createOutboundInstanceWithFirstPickTask(tx, user, orderId, warehouseId) {
        if (!user.companyId)
            throw new common_1.BadRequestException('companyId required on user.');
        const order = await tx.outboundOrder.findUnique({
            where: { id: orderId },
            include: { lines: { orderBy: { lineNumber: 'asc' } } },
        });
        if (!order || order.companyId !== user.companyId)
            throw new common_1.NotFoundException('Outbound order not found.');
        if (order.status !== 'picking' && order.status !== 'confirmed') {
            throw new domain_exceptions_1.InvalidStateException('Workflow requires confirmed / picking outbound order.');
        }
        const existing = await tx.workflowInstance.findFirst({
            where: {
                referenceType: 'outbound_order',
                referenceId: orderId,
                status: { in: ['pending', 'in_progress', 'degraded'] },
            },
        });
        if (existing) {
            const tasks = await tx.warehouseTask.findMany({
                where: { workflowInstanceId: existing.id },
                orderBy: { id: 'asc' },
            });
            return { workflowInstance: existing, nodes: [], tasks };
        }
        const wf = await tx.workflowInstance.create({
            data: {
                companyId: user.companyId,
                warehouseId,
                referenceType: 'outbound_order',
                referenceId: orderId,
                definitionCode: DEF_OUTBOUND,
                status: 'in_progress',
                metadata: { createdByUserId: user.id, stage: 'pick' },
            },
        });
        const nPick = await tx.workflowNode.create({
            data: { instanceId: wf.id, stepKind: client_1.WorkflowStepKind.pick, sequence: 1, status: 'in_progress' },
        });
        const pickPayload = {
            outbound_order_id: orderId,
            lines: order.lines.map((l) => ({
                outbound_order_line_id: l.id,
                requested_qty: l.requestedQuantity.toString(),
            })),
        };
        await tx.warehouseTask.create({
            data: {
                workflowInstanceId: wf.id,
                workflowNodeId: nPick.id,
                taskType: client_1.WarehouseTaskType.pick,
                status: client_1.WarehouseTaskStatus.pending,
                slaMinutes: (0, task_sla_defaults_1.defaultSlaMinutesForTaskType)(client_1.WarehouseTaskType.pick),
                payload: pickPayload,
            },
        });
        const tasks = await tx.warehouseTask.findMany({
            where: { workflowInstanceId: wf.id },
            orderBy: { id: 'asc' },
        });
        const nodes = await tx.workflowNode.findMany({
            where: { instanceId: wf.id },
            orderBy: { sequence: 'asc' },
        });
        return { workflowInstance: wf, nodes, tasks };
    }
};
exports.WorkflowEngineService = WorkflowEngineService;
exports.WorkflowEngineService = WorkflowEngineService = __decorate([
    (0, common_1.Injectable)()
], WorkflowEngineService);
//# sourceMappingURL=workflow-engine.service.js.map