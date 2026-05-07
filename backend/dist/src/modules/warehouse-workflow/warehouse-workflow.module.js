"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WarehouseWorkflowModule = void 0;
const common_1 = require("@nestjs/common");
const redis_module_1 = require("../../common/redis/redis.module");
const prisma_module_1 = require("../../common/prisma/prisma.module");
const inventory_module_1 = require("../inventory/inventory.module");
const workflow_bootstrap_service_1 = require("./workflow-bootstrap.service");
const workflow_orchestration_service_1 = require("./workflow-orchestration.service");
const warehouse_tasks_service_1 = require("./warehouse-tasks.service");
const task_inventory_effects_service_1 = require("./task-inventory-effects.service");
const workflow_workers_service_1 = require("./workflow-workers.service");
const workflow_controller_1 = require("./workflow.controller");
const warehouse_tasks_controller_1 = require("./warehouse-tasks.controller");
const workflow_execution_gate_guard_1 = require("./workflow-execution-gate.guard");
const workflow_workers_controller_1 = require("./workflow-workers.controller");
const analytics_overview_controller_1 = require("./analytics-overview.controller");
const sla_escalation_service_1 = require("./sla-escalation.service");
const workflow_recovery_service_1 = require("./workflow-recovery.service");
const workflow_engine_service_1 = require("./workflow-engine.service");
let WarehouseWorkflowModule = class WarehouseWorkflowModule {
};
exports.WarehouseWorkflowModule = WarehouseWorkflowModule;
exports.WarehouseWorkflowModule = WarehouseWorkflowModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule, inventory_module_1.InventoryModule, redis_module_1.RedisModule],
        controllers: [
            workflow_controller_1.WorkflowController,
            warehouse_tasks_controller_1.WarehouseTasksController,
            workflow_workers_controller_1.WorkflowWorkersController,
            analytics_overview_controller_1.AnalyticsOverviewController,
        ],
        providers: [
            workflow_bootstrap_service_1.WorkflowBootstrapService,
            workflow_engine_service_1.WorkflowEngineService,
            workflow_orchestration_service_1.WorkflowOrchestrationService,
            warehouse_tasks_service_1.WarehouseTasksService,
            task_inventory_effects_service_1.TaskInventoryEffectsService,
            workflow_workers_service_1.WorkflowWorkersService,
            sla_escalation_service_1.SlaEscalationService,
            workflow_recovery_service_1.WorkflowRecoveryService,
            workflow_execution_gate_guard_1.WorkflowExecutionGateGuard,
        ],
        exports: [workflow_bootstrap_service_1.WorkflowBootstrapService, warehouse_tasks_service_1.WarehouseTasksService, workflow_orchestration_service_1.WorkflowOrchestrationService],
    })
], WarehouseWorkflowModule);
//# sourceMappingURL=warehouse-workflow.module.js.map