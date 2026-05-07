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
exports.AdjustmentsController = void 0;
const common_1 = require("@nestjs/common");
const current_user_decorator_1 = require("../../common/auth/current-user.decorator");
const parse_uuid_loose_pipe_1 = require("../../common/pipes/parse-uuid-loose.pipe");
const adjustments_service_1 = require("./adjustments.service");
const add_adjustment_line_dto_1 = require("./dto/add-adjustment-line.dto");
const create_adjustment_dto_1 = require("./dto/create-adjustment.dto");
const list_adjustments_query_dto_1 = require("./dto/list-adjustments-query.dto");
const patch_adjustment_dto_1 = require("./dto/patch-adjustment.dto");
const patch_adjustment_line_dto_1 = require("./dto/patch-adjustment-line.dto");
let AdjustmentsController = class AdjustmentsController {
    adjustments;
    constructor(adjustments) {
        this.adjustments = adjustments;
    }
    create(user, dto) {
        return this.adjustments.create(user, dto);
    }
    list(user, query) {
        return this.adjustments.list(user, query);
    }
    findOne(id) {
        return this.adjustments.findById(id);
    }
    patch(user, id, dto) {
        return this.adjustments.patch(user, id, dto);
    }
    addLine(user, id, dto) {
        return this.adjustments.addLine(user, id, dto);
    }
    patchLine(id, lineId, dto) {
        return this.adjustments.patchLine(id, lineId, dto);
    }
    approve(user, id) {
        return this.adjustments.approve(user, id);
    }
    cancel(id) {
        return this.adjustments.cancel(id);
    }
};
exports.AdjustmentsController = AdjustmentsController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_adjustment_dto_1.CreateAdjustmentDto]),
    __metadata("design:returntype", void 0)
], AdjustmentsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, list_adjustments_query_dto_1.ListAdjustmentsQueryDto]),
    __metadata("design:returntype", void 0)
], AdjustmentsController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdjustmentsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, patch_adjustment_dto_1.PatchAdjustmentDto]),
    __metadata("design:returntype", void 0)
], AdjustmentsController.prototype, "patch", null);
__decorate([
    (0, common_1.Post)(':id/lines'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, add_adjustment_line_dto_1.AddAdjustmentLineDto]),
    __metadata("design:returntype", void 0)
], AdjustmentsController.prototype, "addLine", null);
__decorate([
    (0, common_1.Patch)(':id/lines/:lineId'),
    __param(0, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __param(1, (0, common_1.Param)('lineId', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, patch_adjustment_line_dto_1.PatchAdjustmentLineDto]),
    __metadata("design:returntype", void 0)
], AdjustmentsController.prototype, "patchLine", null);
__decorate([
    (0, common_1.Post)(':id/approve'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AdjustmentsController.prototype, "approve", null);
__decorate([
    (0, common_1.Post)(':id/cancel'),
    __param(0, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdjustmentsController.prototype, "cancel", null);
exports.AdjustmentsController = AdjustmentsController = __decorate([
    (0, common_1.Controller)('adjustments'),
    __metadata("design:paramtypes", [adjustments_service_1.AdjustmentsService])
], AdjustmentsController);
//# sourceMappingURL=adjustments.controller.js.map