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
exports.WorkflowEngineService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const company_access_service_1 = require("../../common/company-access/company-access.service");
const domain_exceptions_1 = require("../../common/errors/domain-exceptions");
const task_sla_defaults_1 = require("./task-sla-defaults");
const workflow_active_util_1 = require("./workflow-active.util");
const DEF_INBOUND = 'inbound_default_v1';
const DEF_OUTBOUND = 'outbound_default_v1';
let WorkflowEngineService = class WorkflowEngineService {
    companyAccess;
    constructor(companyAccess) {
        this.companyAccess = companyAccess;
    }
    async createInboundInstanceWithFirstReceiveTask(tx, user, orderId, warehouseId, stagingOverrides) {
        const tenantCompanyId = this.companyAccess.requireActiveTenant(user);
        await (0, workflow_active_util_1.lockWorkflowReferenceOrder)(tx, client_1.WorkflowReferenceType.inbound_order, orderId);
        const order = await tx.inboundOrder.findUnique({
            where: { id: orderId },
            include: {
                lines: { orderBy: { lineNumber: 'asc' } },
            },
        });
        if (!order) {
            throw new common_1.NotFoundException('Inbound order not found.');
        }
        this.companyAccess.validateResourceOwnership(user, order);
        if (!['confirmed', 'in_progress', 'partially_received'].includes(order.status)) {
            throw new domain_exceptions_1.InvalidStateException('Workflow can only start for an active inbound order.');
        }
        const existing = await (0, workflow_active_util_1.findActiveWorkflowForReference)(tx, client_1.WorkflowReferenceType.inbound_order, orderId);
        if (existing) {
            return (0, workflow_active_util_1.loadWorkflowBootstrapBundle)(tx, existing.id);
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
        try {
            const wf = await tx.workflowInstance.create({
                data: {
                    companyId: tenantCompanyId,
                    warehouseId,
                    referenceType: client_1.WorkflowReferenceType.inbound_order,
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
            return (0, workflow_active_util_1.loadWorkflowBootstrapBundle)(tx, wf.id);
        }
        catch (err) {
            if ((0, workflow_active_util_1.isActiveWorkflowUniqueViolation)(err)) {
                const replay = await (0, workflow_active_util_1.findActiveWorkflowForReference)(tx, client_1.WorkflowReferenceType.inbound_order, orderId);
                if (replay)
                    return (0, workflow_active_util_1.loadWorkflowBootstrapBundle)(tx, replay.id);
            }
            throw err;
        }
    }
    async createOutboundInstanceWithFirstPickTask(tx, user, orderId, warehouseId) {
        const tenantCompanyId = this.companyAccess.requireActiveTenant(user);
        await (0, workflow_active_util_1.lockWorkflowReferenceOrder)(tx, client_1.WorkflowReferenceType.outbound_order, orderId);
        const order = await tx.outboundOrder.findUnique({
            where: { id: orderId },
            include: { lines: { orderBy: { lineNumber: 'asc' } } },
        });
        if (!order)
            throw new common_1.NotFoundException('Outbound order not found.');
        this.companyAccess.validateResourceOwnership(user, order);
        if (order.status !== 'picking' && order.status !== 'confirmed') {
            throw new domain_exceptions_1.InvalidStateException('Workflow requires confirmed / picking outbound order.');
        }
        const existing = await (0, workflow_active_util_1.findActiveWorkflowForReference)(tx, client_1.WorkflowReferenceType.outbound_order, orderId);
        if (existing) {
            return (0, workflow_active_util_1.loadWorkflowBootstrapBundle)(tx, existing.id);
        }
        const pickPayload = {
            outbound_order_id: orderId,
            lines: order.lines.map((l) => ({
                outbound_order_line_id: l.id,
                requested_qty: l.requestedQuantity.toString(),
            })),
        };
        try {
            const wf = await tx.workflowInstance.create({
                data: {
                    companyId: tenantCompanyId,
                    warehouseId,
                    referenceType: client_1.WorkflowReferenceType.outbound_order,
                    referenceId: orderId,
                    definitionCode: DEF_OUTBOUND,
                    status: 'in_progress',
                    metadata: { createdByUserId: user.id, stage: 'pick' },
                },
            });
            const nPick = await tx.workflowNode.create({
                data: {
                    instanceId: wf.id,
                    stepKind: client_1.WorkflowStepKind.pick,
                    sequence: 1,
                    status: 'in_progress',
                },
            });
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
            return (0, workflow_active_util_1.loadWorkflowBootstrapBundle)(tx, wf.id);
        }
        catch (err) {
            if ((0, workflow_active_util_1.isActiveWorkflowUniqueViolation)(err)) {
                const replay = await (0, workflow_active_util_1.findActiveWorkflowForReference)(tx, client_1.WorkflowReferenceType.outbound_order, orderId);
                if (replay)
                    return (0, workflow_active_util_1.loadWorkflowBootstrapBundle)(tx, replay.id);
            }
            throw err;
        }
    }
};
exports.WorkflowEngineService = WorkflowEngineService;
exports.WorkflowEngineService = WorkflowEngineService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [company_access_service_1.CompanyAccessService])
], WorkflowEngineService);
//# sourceMappingURL=workflow-engine.service.js.map