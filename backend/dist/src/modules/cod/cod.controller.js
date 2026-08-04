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
exports.CodController = void 0;
const common_1 = require("@nestjs/common");
const current_user_decorator_1 = require("../../common/auth/current-user.decorator");
const parse_uuid_loose_pipe_1 = require("../../common/pipes/parse-uuid-loose.pipe");
const cod_records_service_1 = require("./cod-records.service");
const cod_dto_1 = require("./dto/cod.dto");
let CodController = class CodController {
    cod;
    constructor(cod) {
        this.cod = cod;
    }
    list(user, query) {
        return this.cod.list(user, query);
    }
    findOne(user, id) {
        return this.cod.findById(id, user);
    }
    byOrder(user, omsOrderId) {
        return this.cod.findByOmsOrder(omsOrderId, user);
    }
    retry(user, omsOrderId) {
        return this.cod.retryGeneration(omsOrderId, user);
    }
    setStatus(user, id, dto) {
        return this.cod.setStatus(id, user, dto.status);
    }
    adjust(user, id, dto) {
        return this.cod.addManualAdjustment(id, user, dto);
    }
};
exports.CodController = CodController;
__decorate([
    (0, common_1.Get)('records'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, cod_dto_1.ListCodRecordsQueryDto]),
    __metadata("design:returntype", void 0)
], CodController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('records/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CodController.prototype, "findOne", null);
__decorate([
    (0, common_1.Get)('by-order/:omsOrderId'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('omsOrderId', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CodController.prototype, "byOrder", null);
__decorate([
    (0, common_1.Post)('orders/:omsOrderId/retry'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('omsOrderId', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CodController.prototype, "retry", null);
__decorate([
    (0, common_1.Patch)('records/:id/status'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, cod_dto_1.UpdateCodStatusDto]),
    __metadata("design:returntype", void 0)
], CodController.prototype, "setStatus", null);
__decorate([
    (0, common_1.Post)('records/:id/adjustments'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, cod_dto_1.CreateCodAdjustmentDto]),
    __metadata("design:returntype", void 0)
], CodController.prototype, "adjust", null);
exports.CodController = CodController = __decorate([
    (0, common_1.Controller)('cod'),
    __metadata("design:paramtypes", [cod_records_service_1.CodRecordsService])
], CodController);
//# sourceMappingURL=cod.controller.js.map