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
exports.WorkflowWorkersController = void 0;
const common_1 = require("@nestjs/common");
const current_user_decorator_1 = require("../../common/auth/current-user.decorator");
const internal_admin_guard_1 = require("../../common/auth/internal-admin.guard");
const workflow_workers_service_1 = require("./workflow-workers.service");
let WorkflowWorkersController = class WorkflowWorkersController {
    workers;
    constructor(workers) {
        this.workers = workers;
    }
    list(user, warehouseId, companyId) {
        return this.workers.list(user, warehouseId, companyId);
    }
    loadByWarehouse(user, warehouseId, companyId) {
        return this.workers.workerLoad(user, warehouseId, companyId);
    }
    listUnlinked(user) {
        return this.workers.listUnlinked(user);
    }
    create(user, body) {
        return this.workers.create(user, body);
    }
    get(user, id) {
        return this.workers.get(id, user);
    }
};
exports.WorkflowWorkersController = WorkflowWorkersController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('warehouseId')),
    __param(2, (0, common_1.Query)('companyId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], WorkflowWorkersController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('load'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('warehouseId')),
    __param(2, (0, common_1.Query)('companyId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], WorkflowWorkersController.prototype, "loadByWarehouse", null);
__decorate([
    (0, common_1.Get)('unlinked'),
    (0, common_1.UseGuards)(internal_admin_guard_1.InternalAdminGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], WorkflowWorkersController.prototype, "listUnlinked", null);
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseGuards)(internal_admin_guard_1.InternalAdminGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], WorkflowWorkersController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], WorkflowWorkersController.prototype, "get", null);
exports.WorkflowWorkersController = WorkflowWorkersController = __decorate([
    (0, common_1.Controller)('workers'),
    __metadata("design:paramtypes", [workflow_workers_service_1.WorkflowWorkersService])
], WorkflowWorkersController);
//# sourceMappingURL=workflow-workers.controller.js.map