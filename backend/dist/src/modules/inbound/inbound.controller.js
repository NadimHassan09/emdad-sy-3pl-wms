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
exports.InboundController = void 0;
const common_1 = require("@nestjs/common");
const current_user_decorator_1 = require("../../common/auth/current-user.decorator");
const confirm_inbound_body_dto_1 = require("./dto/confirm-inbound-body.dto");
const parse_uuid_loose_pipe_1 = require("../../common/pipes/parse-uuid-loose.pipe");
const create_inbound_dto_1 = require("./dto/create-inbound.dto");
const list_inbound_query_dto_1 = require("./dto/list-inbound-query.dto");
const receive_line_dto_1 = require("./dto/receive-line.dto");
const inbound_service_1 = require("./inbound.service");
let InboundController = class InboundController {
    inbound;
    constructor(inbound) {
        this.inbound = inbound;
    }
    create(user, dto) {
        return this.inbound.create(user, dto);
    }
    list(user, query) {
        return this.inbound.list(user, query);
    }
    findOne(id) {
        return this.inbound.findById(id);
    }
    confirm(user, id, body) {
        return this.inbound.confirm(user, id, body);
    }
    cancel(user, id) {
        return this.inbound.cancel(id, user);
    }
    receive(user, id, lineId, dto) {
        return this.inbound.receiveLine(user, id, lineId, dto);
    }
};
exports.InboundController = InboundController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_inbound_dto_1.CreateInboundOrderDto]),
    __metadata("design:returntype", void 0)
], InboundController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, list_inbound_query_dto_1.ListInboundQueryDto]),
    __metadata("design:returntype", void 0)
], InboundController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], InboundController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(':id/confirm'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, confirm_inbound_body_dto_1.ConfirmInboundBodyDto]),
    __metadata("design:returntype", void 0)
], InboundController.prototype, "confirm", null);
__decorate([
    (0, common_1.Post)(':id/cancel'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], InboundController.prototype, "cancel", null);
__decorate([
    (0, common_1.Post)(':id/lines/:lineId/receive'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __param(2, (0, common_1.Param)('lineId', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, receive_line_dto_1.ReceiveLineDto]),
    __metadata("design:returntype", void 0)
], InboundController.prototype, "receive", null);
exports.InboundController = InboundController = __decorate([
    (0, common_1.Controller)('inbound-orders'),
    __metadata("design:paramtypes", [inbound_service_1.InboundService])
], InboundController);
//# sourceMappingURL=inbound.controller.js.map