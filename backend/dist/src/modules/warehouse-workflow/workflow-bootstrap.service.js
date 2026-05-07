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
exports.WorkflowBootstrapService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const feature_flags_1 = require("./feature-flags");
const task_runnable_util_1 = require("./task-runnable.util");
const workflow_timeline_helpers_1 = require("./workflow-timeline.helpers");
const workflow_engine_service_1 = require("./workflow-engine.service");
let WorkflowBootstrapService = class WorkflowBootstrapService {
    prisma;
    config;
    engine;
    constructor(prisma, config, engine) {
        this.prisma = prisma;
        this.config = config;
        this.engine = engine;
    }
    async startInboundWorkflow(user, orderId, warehouseId, stagingOverrides) {
        return this.prisma.$transaction((tx) => this.engine.createInboundInstanceWithFirstReceiveTask(tx, user, orderId, warehouseId, stagingOverrides));
    }
    async startInboundWorkflowTx(tx, user, orderId, warehouseId, stagingOverrides) {
        return this.engine.createInboundInstanceWithFirstReceiveTask(tx, user, orderId, warehouseId, stagingOverrides);
    }
    async startOutboundWorkflow(user, orderId, warehouseId) {
        return this.prisma.$transaction((tx) => this.engine.createOutboundInstanceWithFirstPickTask(tx, user, orderId, warehouseId));
    }
    async startOutboundWorkflowTx(tx, user, orderId, warehouseId) {
        return this.engine.createOutboundInstanceWithFirstPickTask(tx, user, orderId, warehouseId);
    }
    async getWorkflowTimeline(user, referenceType, referenceId) {
        if (!user.companyId)
            throw new common_1.BadRequestException('companyId required.');
        const wf = await this.prisma.workflowInstance.findFirst({
            where: {
                referenceType,
                referenceId,
                companyId: user.companyId,
            },
            orderBy: { createdAt: 'desc' },
        });
        if (!wf) {
            return {
                workflowInstance: null,
                tasks: [],
                steps: (0, workflow_timeline_helpers_1.buildWorkflowTimelineSteps)(referenceType, []),
            };
        }
        const tasks = await this.prisma.warehouseTask.findMany({
            where: { workflowInstanceId: wf.id },
            orderBy: { createdAt: 'asc' },
            include: {
                assignments: { where: { unassignedAt: null }, take: 1, include: { worker: true } },
            },
        });
        const light = tasks.map((t) => ({
            id: t.id,
            workflowInstanceId: t.workflowInstanceId,
            taskType: t.taskType,
            status: t.status,
        }));
        const stepRows = tasks.map((t) => ({
            id: t.id,
            workflowInstanceId: t.workflowInstanceId,
            taskType: t.taskType,
            status: t.status,
            createdAt: t.createdAt,
        }));
        return {
            workflowInstance: wf,
            tasks: tasks.map((t) => ({
                ...t,
                is_current_runnable: (0, task_runnable_util_1.getFrontierBlockedReason)(t.id, light, referenceType) === null,
                runnability_blocked_reason: (0, task_runnable_util_1.getFrontierBlockedReason)(t.id, light, referenceType),
            })),
            steps: (0, workflow_timeline_helpers_1.buildWorkflowTimelineSteps)(referenceType, stepRows),
        };
    }
    async getWorkflowInstanceGraph(user, instanceId) {
        if (!user.companyId)
            throw new common_1.BadRequestException('companyId required.');
        const wf = await this.prisma.workflowInstance.findUnique({
            where: { id: instanceId },
        });
        if (!wf || wf.companyId !== user.companyId)
            throw new common_1.NotFoundException('Workflow instance not found.');
        const [nodes, tasks] = await Promise.all([
            this.prisma.workflowNode.findMany({
                where: { instanceId },
                orderBy: { sequence: 'asc' },
            }),
            this.prisma.warehouseTask.findMany({
                where: { workflowInstanceId: instanceId },
                orderBy: { createdAt: 'asc' },
                include: {
                    assignments: { where: { unassignedAt: null }, take: 1, include: { worker: true } },
                },
            }),
        ]);
        const refTag = wf.referenceType === client_1.WorkflowReferenceType.inbound_order
            ? 'inbound_order'
            : wf.referenceType === client_1.WorkflowReferenceType.outbound_order
                ? 'outbound_order'
                : wf.referenceType;
        const light = tasks.map((t) => ({
            id: t.id,
            workflowInstanceId: t.workflowInstanceId,
            taskType: t.taskType,
            status: t.status,
        }));
        return {
            workflowInstance: wf,
            nodes,
            tasks: tasks.map((t) => ({
                ...t,
                is_current_runnable: (0, task_runnable_util_1.getFrontierBlockedReason)(t.id, light, refTag) === null,
                runnability_blocked_reason: (0, task_runnable_util_1.getFrontierBlockedReason)(t.id, light, refTag),
            })),
        };
    }
    async getWorkflowInstanceGraphByReference(user, referenceType, referenceId) {
        if (!user.companyId)
            throw new common_1.BadRequestException('companyId required.');
        const wf = await this.prisma.workflowInstance.findFirst({
            where: {
                referenceType,
                referenceId,
                companyId: user.companyId,
                status: { in: ['pending', 'in_progress', 'degraded'] },
            },
            orderBy: { createdAt: 'desc' },
        });
        if (!wf)
            throw new common_1.NotFoundException('Workflow instance not found for reference.');
        return this.getWorkflowInstanceGraph(user, wf.id);
    }
    async getWorkflowContextSettings(user, warehouseId) {
        if (!user.companyId)
            throw new common_1.BadRequestException('companyId required.');
        const flag = (0, feature_flags_1.taskOnlyFlows)(this.config);
        const defaults = {
            showAdvancedJson: false,
            confirmUnsavedDraft: true,
        };
        const company = await this.prisma.company.findUnique({
            where: { id: user.companyId },
            select: { workflowUxSettings: true },
        });
        let warehouse = null;
        if (warehouseId) {
            warehouse = await this.prisma.warehouse.findUnique({
                where: { id: warehouseId },
                select: { workflowUxSettings: true },
            });
            if (!warehouse)
                throw new common_1.NotFoundException('Warehouse not found.');
        }
        const c = company?.workflowUxSettings ?? {};
        const w = warehouse?.workflowUxSettings ?? {};
        const merged = {
            ...defaults,
            ...c,
            ...w,
        };
        const wid = (warehouseId ?? '').trim();
        return {
            taskOnlyFlows: flag,
            warehouseId: wid,
            defaults,
            company: company?.workflowUxSettings ?? null,
            warehouse: warehouse?.workflowUxSettings ?? null,
            effective: merged,
        };
    }
};
exports.WorkflowBootstrapService = WorkflowBootstrapService;
exports.WorkflowBootstrapService = WorkflowBootstrapService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService,
        workflow_engine_service_1.WorkflowEngineService])
], WorkflowBootstrapService);
//# sourceMappingURL=workflow-bootstrap.service.js.map