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
exports.WorkflowExecutionGateGuard = void 0;
const common_1 = require("@nestjs/common");
const warehouse_tasks_service_1 = require("./warehouse-tasks.service");
let WorkflowExecutionGateGuard = class WorkflowExecutionGateGuard {
    tasks;
    constructor(tasks) {
        this.tasks = tasks;
    }
    async canActivate(context) {
        const req = context.switchToHttp().getRequest();
        const taskId = req.params?.id?.trim();
        const user = req.user;
        if (!taskId || user == null)
            return true;
        await this.tasks.ensureRunnableForExecutionGate(taskId, user);
        return true;
    }
};
exports.WorkflowExecutionGateGuard = WorkflowExecutionGateGuard;
exports.WorkflowExecutionGateGuard = WorkflowExecutionGateGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [warehouse_tasks_service_1.WarehouseTasksService])
], WorkflowExecutionGateGuard);
//# sourceMappingURL=workflow-execution-gate.guard.js.map