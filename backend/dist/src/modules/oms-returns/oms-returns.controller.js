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
exports.OmsReturnsController = void 0;
const common_1 = require("@nestjs/common");
const current_user_decorator_1 = require("../../common/auth/current-user.decorator");
const parse_uuid_loose_pipe_1 = require("../../common/pipes/parse-uuid-loose.pipe");
const oms_return_dto_1 = require("./dto/oms-return.dto");
const oms_returns_service_1 = require("./oms-returns.service");
let OmsReturnsController = class OmsReturnsController {
    returns;
    constructor(returns) {
        this.returns = returns;
    }
    list(user, query) {
        return this.returns.list(user, query);
    }
    create(user, dto) {
        return this.returns.create(user, dto);
    }
    expressReturn(user, body) {
        return this.returns.expressReturn(user, body);
    }
    validateExpressReturn(user, body) {
        return this.returns.validateOrdersForExpressReturn(user, body);
    }
    preview(user, dto) {
        return this.returns.previewNormalReturn(user, dto);
    }
    validateImportRows(user, dto) {
        return this.returns.validateNormalReturnImport(user, dto);
    }
    importRows(user, dto) {
        return this.returns.importNormalReturns(user, dto);
    }
    findOne(user, id) {
        return this.returns.findById(id, user);
    }
    updatePlan(user, id, dto) {
        return this.returns.updatePlan(id, user, dto);
    }
    approve(user, id, dto) {
        return this.returns.approve(id, user, dto);
    }
    completeReceiving(user, id) {
        return this.returns.completeReceivingAdmin(id, user);
    }
    completePutaway(user, id) {
        return this.returns.completePutawayAdmin(id, user);
    }
    reject(user, id, dto) {
        return this.returns.reject(id, user, dto);
    }
    confirm(user, id) {
        return this.returns.confirmReturn(id, user);
    }
    confirmBulk(user, body) {
        return this.returns.confirmReturnsBulk(body.ids, user);
    }
    confirmByScan(user, body) {
        return this.returns.confirmReturnByScan(user, body.code);
    }
};
exports.OmsReturnsController = OmsReturnsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, oms_returns_service_1.ListOmsReturnsQueryDto]),
    __metadata("design:returntype", void 0)
], OmsReturnsController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, oms_return_dto_1.CreateOmsReturnDto]),
    __metadata("design:returntype", void 0)
], OmsReturnsController.prototype, "create", null);
__decorate([
    (0, common_1.Post)('express'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], OmsReturnsController.prototype, "expressReturn", null);
__decorate([
    (0, common_1.Post)('express/validate'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], OmsReturnsController.prototype, "validateExpressReturn", null);
__decorate([
    (0, common_1.Post)('preview'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, oms_return_dto_1.PreviewOmsReturnDto]),
    __metadata("design:returntype", void 0)
], OmsReturnsController.prototype, "preview", null);
__decorate([
    (0, common_1.Post)('import/validate'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, oms_return_dto_1.ImportOmsReturnsDto]),
    __metadata("design:returntype", void 0)
], OmsReturnsController.prototype, "validateImportRows", null);
__decorate([
    (0, common_1.Post)('import'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, oms_return_dto_1.ImportOmsReturnsDto]),
    __metadata("design:returntype", void 0)
], OmsReturnsController.prototype, "importRows", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], OmsReturnsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id/plan'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, oms_return_dto_1.UpdateOmsReturnPlanDto]),
    __metadata("design:returntype", void 0)
], OmsReturnsController.prototype, "updatePlan", null);
__decorate([
    (0, common_1.Post)(':id/approve'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, oms_return_dto_1.ApproveOmsReturnDto]),
    __metadata("design:returntype", void 0)
], OmsReturnsController.prototype, "approve", null);
__decorate([
    (0, common_1.Post)(':id/complete-receiving'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], OmsReturnsController.prototype, "completeReceiving", null);
__decorate([
    (0, common_1.Post)(':id/complete-putaway'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], OmsReturnsController.prototype, "completePutaway", null);
__decorate([
    (0, common_1.Post)(':id/reject'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, oms_return_dto_1.RejectOmsReturnDto]),
    __metadata("design:returntype", void 0)
], OmsReturnsController.prototype, "reject", null);
__decorate([
    (0, common_1.Post)(':id/confirm'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], OmsReturnsController.prototype, "confirm", null);
__decorate([
    (0, common_1.Post)('confirm-bulk'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], OmsReturnsController.prototype, "confirmBulk", null);
__decorate([
    (0, common_1.Post)('confirm-by-scan'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], OmsReturnsController.prototype, "confirmByScan", null);
exports.OmsReturnsController = OmsReturnsController = __decorate([
    (0, common_1.Controller)('oms/returns'),
    __metadata("design:paramtypes", [oms_returns_service_1.OmsReturnsService])
], OmsReturnsController);
//# sourceMappingURL=oms-returns.controller.js.map