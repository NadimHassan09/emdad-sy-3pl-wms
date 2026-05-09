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
exports.ClientOutboundOrdersController = void 0;
const common_1 = require("@nestjs/common");
const public_decorator_1 = require("../../../common/auth/public.decorator");
const parse_uuid_loose_pipe_1 = require("../../../common/pipes/parse-uuid-loose.pipe");
const list_outbound_query_dto_1 = require("../../outbound/dto/list-outbound-query.dto");
const client_user_decorator_1 = require("../auth/client-user.decorator");
const jwt_client_auth_guard_1 = require("../auth/jwt-client-auth.guard");
const client_outbound_orders_service_1 = require("./client-outbound-orders.service");
let ClientOutboundOrdersController = class ClientOutboundOrdersController {
    outbound;
    constructor(outbound) {
        this.outbound = outbound;
    }
    list(client, query) {
        return this.outbound.list(client, query);
    }
    findOne(client, id) {
        return this.outbound.findOne(client, id);
    }
};
exports.ClientOutboundOrdersController = ClientOutboundOrdersController;
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)(),
    (0, common_1.UseGuards)(jwt_client_auth_guard_1.JwtClientAuthGuard),
    __param(0, (0, client_user_decorator_1.ClientUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, list_outbound_query_dto_1.ListOutboundQueryDto]),
    __metadata("design:returntype", void 0)
], ClientOutboundOrdersController.prototype, "list", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)(':id'),
    (0, common_1.UseGuards)(jwt_client_auth_guard_1.JwtClientAuthGuard),
    __param(0, (0, client_user_decorator_1.ClientUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ClientOutboundOrdersController.prototype, "findOne", null);
exports.ClientOutboundOrdersController = ClientOutboundOrdersController = __decorate([
    (0, common_1.Controller)('client/outbound-orders'),
    __metadata("design:paramtypes", [client_outbound_orders_service_1.ClientOutboundOrdersService])
], ClientOutboundOrdersController);
//# sourceMappingURL=client-outbound-orders.controller.js.map