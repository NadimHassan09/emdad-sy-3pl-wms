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
exports.ReturnsController = void 0;
const common_1 = require("@nestjs/common");
const current_user_decorator_1 = require("../../common/auth/current-user.decorator");
const parse_uuid_loose_pipe_1 = require("../../common/pipes/parse-uuid-loose.pipe");
const create_return_order_dto_1 = require("./dto/create-return-order.dto");
const list_return_orders_query_dto_1 = require("./dto/list-return-orders-query.dto");
const apply_return_disposition_dto_1 = require("./dto/apply-return-disposition.dto");
const inspect_return_line_dto_1 = require("./dto/inspect-return-line.dto");
const receive_return_line_dto_1 = require("./dto/receive-return-line.dto");
const returns_service_1 = require("./returns.service");
let ReturnsController = class ReturnsController {
    returns;
    constructor(returns) {
        this.returns = returns;
    }
    create(user, dto) {
        return this.returns.create(user, dto);
    }
    list(user, query) {
        return this.returns.list(user, query);
    }
    getOutboundQuota(user, outboundId, excludeReturnOrderId) {
        return this.returns.getOutboundReturnQuota(user, outboundId, excludeReturnOrderId);
    }
    findOne(user, id) {
        return this.returns.findById(id, user);
    }
    confirm(user, id) {
        return this.returns.confirm(user, id);
    }
    startReceiving(user, id) {
        return this.returns.startReceiving(user, id);
    }
    complete(user, id) {
        return this.returns.complete(user, id);
    }
    cancel(user, id) {
        return this.returns.cancel(user, id);
    }
    receiveLine(user, id, lineId, dto) {
        return this.returns.receiveLine(user, id, lineId, dto);
    }
    inspectLine(user, id, lineId, dto) {
        return this.returns.inspectLine(user, id, lineId, dto);
    }
    applyDisposition(user, id, lineId, dto) {
        return this.returns.applyDisposition(user, id, lineId, dto);
    }
    postInventory(user, id) {
        return this.returns.postAllInventory(user, id);
    }
};
exports.ReturnsController = ReturnsController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_return_order_dto_1.CreateReturnOrderDto]),
    __metadata("design:returntype", void 0)
], ReturnsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, list_return_orders_query_dto_1.ListReturnOrdersQueryDto]),
    __metadata("design:returntype", void 0)
], ReturnsController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('outbound-quota/:outboundId'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('outboundId', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __param(2, (0, common_1.Query)('excludeReturnOrderId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], ReturnsController.prototype, "getOutboundQuota", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ReturnsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(':id/confirm'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ReturnsController.prototype, "confirm", null);
__decorate([
    (0, common_1.Post)(':id/start-receiving'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ReturnsController.prototype, "startReceiving", null);
__decorate([
    (0, common_1.Post)(':id/complete'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ReturnsController.prototype, "complete", null);
__decorate([
    (0, common_1.Post)(':id/cancel'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ReturnsController.prototype, "cancel", null);
__decorate([
    (0, common_1.Post)(':id/lines/:lineId/receive'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __param(2, (0, common_1.Param)('lineId', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, receive_return_line_dto_1.ReceiveReturnLineDto]),
    __metadata("design:returntype", void 0)
], ReturnsController.prototype, "receiveLine", null);
__decorate([
    (0, common_1.Post)(':id/lines/:lineId/inspect'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __param(2, (0, common_1.Param)('lineId', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, inspect_return_line_dto_1.InspectReturnLineDto]),
    __metadata("design:returntype", void 0)
], ReturnsController.prototype, "inspectLine", null);
__decorate([
    (0, common_1.Post)(':id/lines/:lineId/apply-disposition'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __param(2, (0, common_1.Param)('lineId', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, apply_return_disposition_dto_1.ApplyReturnDispositionDto]),
    __metadata("design:returntype", void 0)
], ReturnsController.prototype, "applyDisposition", null);
__decorate([
    (0, common_1.Post)(':id/post-inventory'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ReturnsController.prototype, "postInventory", null);
exports.ReturnsController = ReturnsController = __decorate([
    (0, common_1.Controller)('return-orders'),
    __metadata("design:paramtypes", [returns_service_1.ReturnsService])
], ReturnsController);
//# sourceMappingURL=returns.controller.js.map