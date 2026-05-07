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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowController = void 0;
const common_1 = require("@nestjs/common");
const current_user_decorator_1 = require("../../common/auth/current-user.decorator");
const start_workflow_dto_1 = require("./dto/start-workflow.dto");
const workflow_bootstrap_service_1 = require("./workflow-bootstrap.service");
const workflow_recovery_service_1 = require("./workflow-recovery.service");
let WorkflowController = class WorkflowController {
    workflow;
    workflowRecovery;
    constructor(workflow, workflowRecovery) {
        this.workflow = workflow;
        this.workflowRecovery = workflowRecovery;
    }
    getContextSettings(user, warehouseId) {
        return this.workflow.getWorkflowContextSettings(user, warehouseId);
    }
    getInstanceGraphByReference(user, referenceType, referenceId) {
        if (referenceType !== 'inbound_order' && referenceType !== 'outbound_order') {
            throw new common_1.BadRequestException('reference_type must be inbound_order or outbound_order.');
        }
        if (!referenceId?.trim()) {
            throw new common_1.BadRequestException('reference_id is required.');
        }
        return this.workflow.getWorkflowInstanceGraphByReference(user, referenceType, referenceId);
    }
    getInstanceGraph(user, instanceId) {
        return this.workflow.getWorkflowInstanceGraph(user, instanceId);
    }
    getTimeline(user, referenceType, referenceId) {
        if (referenceType !== 'inbound_order' && referenceType !== 'outbound_order') {
            throw new common_1.BadRequestException('referenceType must be inbound_order or outbound_order.');
        }
        return this.workflow.getWorkflowTimeline(user, referenceType, referenceId);
    }
    startInbound(user, orderId, body) {
        if (!body.stagingByLineId || typeof body.stagingByLineId !== 'object') {
            throw new common_1.BadRequestException('stagingByLineId is required (map lineId → stagingLocationId).');
        }
        return this.workflow.startInboundWorkflow(user, orderId, body.warehouseId, body.stagingByLineId);
    }
    startOutbound(user, orderId, body) {
        return this.workflow.startOutboundWorkflow(user, orderId, body.warehouseId);
    }
    recoverWorkflowInstance(user, instanceId, body) {
        return this.workflowRecovery.recoverWorkflowInstance(instanceId, user, body);
    }
};
exports.WorkflowController = WorkflowController;
__decorate([
    (0, common_1.Get)('context-settings'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('warehouse_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], WorkflowController.prototype, "getContextSettings", null);
__decorate([
    (0, common_1.Get)('instances/by-reference'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('reference_type')),
    __param(2, (0, common_1.Query)('reference_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], WorkflowController.prototype, "getInstanceGraphByReference", null);
__decorate([
    (0, common_1.Get)('instances/:instanceId/graph'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('instanceId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], WorkflowController.prototype, "getInstanceGraph", null);
__decorate([
    (0, common_1.Get)('references/:referenceType/:referenceId'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('referenceType')),
    __param(2, (0, common_1.Param)('referenceId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], WorkflowController.prototype, "getTimeline", null);
__decorate([
    (0, common_1.Post)('inbound/:orderId/start'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('orderId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, start_workflow_dto_1.StartWorkflowBodyDto]),
    __metadata("design:returntype", void 0)
], WorkflowController.prototype, "startInbound", null);
__decorate([
    (0, common_1.Post)('outbound/:orderId/start'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('orderId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, start_workflow_dto_1.StartWorkflowBodyDto]),
    __metadata("design:returntype", void 0)
], WorkflowController.prototype, "startOutbound", null);
__decorate([
    (0, common_1.Post)('instances/:instanceId/recover'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('instanceId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], WorkflowController.prototype, "recoverWorkflowInstance", null);
exports.WorkflowController = WorkflowController = __decorate([
    (0, common_1.Controller)('workflows'),
    __metadata("design:paramtypes", [workflow_bootstrap_service_1.WorkflowBootstrapService,
        workflow_recovery_service_1.WorkflowRecoveryService])
], WorkflowController);
//# sourceMappingURL=workflow.controller.js.map