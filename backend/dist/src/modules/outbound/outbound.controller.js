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
exports.OutboundController = void 0;
const common_1 = require("@nestjs/common");
const current_user_decorator_1 = require("../../common/auth/current-user.decorator");
const parse_uuid_loose_pipe_1 = require("../../common/pipes/parse-uuid-loose.pipe");
const create_outbound_dto_1 = require("./dto/create-outbound.dto");
const confirm_outbound_body_dto_1 = require("./dto/confirm-outbound-body.dto");
const list_outbound_query_dto_1 = require("./dto/list-outbound-query.dto");
const outbound_service_1 = require("./outbound.service");
let OutboundController = class OutboundController {
    outbound;
    constructor(outbound) {
        this.outbound = outbound;
    }
    create(user, dto) {
        return this.outbound.create(user, dto);
    }
    list(user, query) {
        return this.outbound.list(user, query);
    }
    findOne(id) {
        return this.outbound.findById(id);
    }
    confirm(user, id, body) {
        return this.outbound.confirmAndDeduct(user, id, body);
    }
    cancel(user, id) {
        return this.outbound.cancel(id, user);
    }
};
exports.OutboundController = OutboundController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_outbound_dto_1.CreateOutboundOrderDto]),
    __metadata("design:returntype", void 0)
], OutboundController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, list_outbound_query_dto_1.ListOutboundQueryDto]),
    __metadata("design:returntype", void 0)
], OutboundController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], OutboundController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(':id/confirm'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, confirm_outbound_body_dto_1.ConfirmOutboundBodyDto]),
    __metadata("design:returntype", void 0)
], OutboundController.prototype, "confirm", null);
__decorate([
    (0, common_1.Post)(':id/cancel'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], OutboundController.prototype, "cancel", null);
exports.OutboundController = OutboundController = __decorate([
    (0, common_1.Controller)('outbound-orders'),
    __metadata("design:paramtypes", [outbound_service_1.OutboundService])
], OutboundController);
//# sourceMappingURL=outbound.controller.js.map