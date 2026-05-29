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
exports.CycleCountExecutionController = void 0;
const common_1 = require("@nestjs/common");
const auth_groups_1 = require("../../common/auth/auth-groups");
const current_user_decorator_1 = require("../../common/auth/current-user.decorator");
const roles_decorator_1 = require("../../common/auth/roles.decorator");
const roles_guard_1 = require("../../common/auth/roles.guard");
const parse_uuid_loose_pipe_1 = require("../../common/pipes/parse-uuid-loose.pipe");
const cycle_count_execution_service_1 = require("./cycle-count-execution.service");
const list_execution_tasks_query_dto_1 = require("./dto/list-execution-tasks-query.dto");
const skip_cycle_count_line_dto_1 = require("./dto/skip-cycle-count-line.dto");
const submit_line_count_dto_1 = require("./dto/submit-line-count.dto");
let CycleCountExecutionController = class CycleCountExecutionController {
    execution;
    constructor(execution) {
        this.execution = execution;
    }
    listTasks(user, query) {
        return this.execution.listMyTasks(user, query.warehouseId);
    }
    getTask(user, id) {
        return this.execution.getTask(user, id);
    }
    claimTask(user, id) {
        return this.execution.claimTask(user, id);
    }
    submitLineCount(user, id, lineId, dto) {
        return this.execution.submitLineCount(user, id, lineId, dto);
    }
    skipLine(user, id, lineId, dto) {
        return this.execution.skipLine(user, id, lineId, dto);
    }
    finishTask(user, id) {
        return this.execution.finishTask(user, id);
    }
};
exports.CycleCountExecutionController = CycleCountExecutionController;
__decorate([
    (0, common_1.Get)('tasks'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, list_execution_tasks_query_dto_1.ListExecutionTasksQueryDto]),
    __metadata("design:returntype", void 0)
], CycleCountExecutionController.prototype, "listTasks", null);
__decorate([
    (0, common_1.Get)('tasks/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CycleCountExecutionController.prototype, "getTask", null);
__decorate([
    (0, common_1.Post)('tasks/:id/claim'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CycleCountExecutionController.prototype, "claimTask", null);
__decorate([
    (0, common_1.Post)('tasks/:id/lines/:lineId/count'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __param(2, (0, common_1.Param)('lineId', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, submit_line_count_dto_1.SubmitLineCountDto]),
    __metadata("design:returntype", void 0)
], CycleCountExecutionController.prototype, "submitLineCount", null);
__decorate([
    (0, common_1.Post)('tasks/:id/lines/:lineId/skip'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __param(2, (0, common_1.Param)('lineId', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, skip_cycle_count_line_dto_1.SkipCycleCountLineDto]),
    __metadata("design:returntype", void 0)
], CycleCountExecutionController.prototype, "skipLine", null);
__decorate([
    (0, common_1.Post)('tasks/:id/finish'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CycleCountExecutionController.prototype, "finishTask", null);
exports.CycleCountExecutionController = CycleCountExecutionController = __decorate([
    (0, common_1.Controller)('cycle-count/execution'),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(auth_groups_1.AuthGroup.OPERATOR, auth_groups_1.AuthGroup.ADMIN),
    __metadata("design:paramtypes", [cycle_count_execution_service_1.CycleCountExecutionService])
], CycleCountExecutionController);
//# sourceMappingURL=cycle-count-execution.controller.js.map