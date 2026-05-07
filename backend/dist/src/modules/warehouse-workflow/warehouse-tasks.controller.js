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
exports.WarehouseTasksController = void 0;
const common_1 = require("@nestjs/common");
const current_user_decorator_1 = require("../../common/auth/current-user.decorator");
const warehouse_tasks_service_1 = require("./warehouse-tasks.service");
const list_tasks_query_dto_1 = require("./dto/list-tasks-query.dto");
const resolve_task_dto_1 = require("./dto/resolve-task.dto");
const retry_task_dto_1 = require("./dto/retry-task.dto");
const lease_task_dto_1 = require("./dto/lease-task.dto");
const patch_task_progress_dto_1 = require("./dto/patch-task-progress.dto");
const skip_task_dto_1 = require("./dto/skip-task.dto");
const workflow_execution_gate_guard_1 = require("./workflow-execution-gate.guard");
let WarehouseTasksController = class WarehouseTasksController {
    tasks;
    constructor(tasks) {
        this.tasks = tasks;
    }
    list(user, query) {
        return this.tasks.list(user, {
            status: query.status,
            taskType: query.taskType,
            warehouseId: query.warehouseId,
            workerId: query.workerId,
            referenceId: query.referenceId,
            updatedFrom: query.updatedFrom ? new Date(query.updatedFrom) : undefined,
            updatedTo: query.updatedTo ? new Date(query.updatedTo) : undefined,
            limit: query.limit ?? 100,
            offset: query.offset ?? 0,
        });
    }
    pathOrder(user, id) {
        return this.tasks.getPathOrder(id, user);
    }
    patchProgress(user, id, body) {
        return this.tasks.patchProgress(id, user, body);
    }
    leaseAcquire(user, id, body) {
        return this.tasks.leaseAcquire(id, user, body?.minutes);
    }
    leaseRelease(user, id) {
        return this.tasks.leaseRelease(id, user);
    }
    detail(user, id) {
        return this.tasks.getById(id, user);
    }
    assign(user, id, body) {
        return this.tasks.assign(id, user, body.workerId);
    }
    unassign(user, id) {
        return this.tasks.unassign(id, user);
    }
    start(user, id, body) {
        return this.tasks.start(id, user, body.workerId);
    }
    complete(user, id, body) {
        return this.tasks.complete(id, user, body);
    }
    cancel(user, id, body) {
        return this.tasks.cancel(id, user, body.reason);
    }
    skip(user, id, body) {
        return this.tasks.skipTask(id, user, body);
    }
    retry(user, id, body) {
        return this.tasks.retry(id, user, body);
    }
    resolve(user, id, body) {
        return this.tasks.resolveBlocked(id, user, body);
    }
    reopen(user, id) {
        return this.tasks.reopen(id, user);
    }
};
exports.WarehouseTasksController = WarehouseTasksController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, list_tasks_query_dto_1.ListTasksQueryDto]),
    __metadata("design:returntype", void 0)
], WarehouseTasksController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id/path-order'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], WarehouseTasksController.prototype, "pathOrder", null);
__decorate([
    (0, common_1.Put)(':id/progress'),
    (0, common_1.UseGuards)(workflow_execution_gate_guard_1.WorkflowExecutionGateGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, patch_task_progress_dto_1.PatchTaskProgressDto]),
    __metadata("design:returntype", void 0)
], WarehouseTasksController.prototype, "patchProgress", null);
__decorate([
    (0, common_1.Post)(':id/lease'),
    (0, common_1.UseGuards)(workflow_execution_gate_guard_1.WorkflowExecutionGateGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, lease_task_dto_1.LeaseTaskDto]),
    __metadata("design:returntype", void 0)
], WarehouseTasksController.prototype, "leaseAcquire", null);
__decorate([
    (0, common_1.Post)(':id/lease/release'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], WarehouseTasksController.prototype, "leaseRelease", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], WarehouseTasksController.prototype, "detail", null);
__decorate([
    (0, common_1.Post)(':id/assign'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], WarehouseTasksController.prototype, "assign", null);
__decorate([
    (0, common_1.Post)(':id/unassign'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], WarehouseTasksController.prototype, "unassign", null);
__decorate([
    (0, common_1.Post)(':id/start'),
    (0, common_1.UseGuards)(workflow_execution_gate_guard_1.WorkflowExecutionGateGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], WarehouseTasksController.prototype, "start", null);
__decorate([
    (0, common_1.Post)(':id/complete'),
    (0, common_1.UseGuards)(workflow_execution_gate_guard_1.WorkflowExecutionGateGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], WarehouseTasksController.prototype, "complete", null);
__decorate([
    (0, common_1.Post)(':id/cancel'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], WarehouseTasksController.prototype, "cancel", null);
__decorate([
    (0, common_1.Post)(':id/skip'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, skip_task_dto_1.SkipTaskDto]),
    __metadata("design:returntype", void 0)
], WarehouseTasksController.prototype, "skip", null);
__decorate([
    (0, common_1.Post)(':id/retry'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, retry_task_dto_1.RetryTaskDto]),
    __metadata("design:returntype", void 0)
], WarehouseTasksController.prototype, "retry", null);
__decorate([
    (0, common_1.Post)(':id/resolve'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, resolve_task_dto_1.ResolveTaskDto]),
    __metadata("design:returntype", void 0)
], WarehouseTasksController.prototype, "resolve", null);
__decorate([
    (0, common_1.Post)(':id/reopen'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], WarehouseTasksController.prototype, "reopen", null);
exports.WarehouseTasksController = WarehouseTasksController = __decorate([
    (0, common_1.Controller)('tasks'),
    __metadata("design:paramtypes", [warehouse_tasks_service_1.WarehouseTasksService])
], WarehouseTasksController);
//# sourceMappingURL=warehouse-tasks.controller.js.map