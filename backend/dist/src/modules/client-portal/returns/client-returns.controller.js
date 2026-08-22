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
exports.ClientReturnsController = void 0;
const common_1 = require("@nestjs/common");
const public_decorator_1 = require("../../../common/auth/public.decorator");
const parse_uuid_loose_pipe_1 = require("../../../common/pipes/parse-uuid-loose.pipe");
const create_return_order_dto_1 = require("../../returns/dto/create-return-order.dto");
const list_return_orders_query_dto_1 = require("../../returns/dto/list-return-orders-query.dto");
const client_user_decorator_1 = require("../auth/client-user.decorator");
const jwt_client_auth_guard_1 = require("../auth/jwt-client-auth.guard");
const client_returns_service_1 = require("./client-returns.service");
let ClientReturnsController = class ClientReturnsController {
    returns;
    constructor(returns) {
        this.returns = returns;
    }
    list(client, query) {
        return this.returns.list(client, query);
    }
    getOutboundQuota(client, outboundId) {
        return this.returns.getOutboundQuota(client, outboundId);
    }
    findOne(client, id) {
        return this.returns.findOne(client, id);
    }
    create(client, body) {
        return this.returns.create(client, body);
    }
};
exports.ClientReturnsController = ClientReturnsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, client_user_decorator_1.ClientUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, list_return_orders_query_dto_1.ListReturnOrdersQueryDto]),
    __metadata("design:returntype", void 0)
], ClientReturnsController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('outbound-quota/:outboundId'),
    __param(0, (0, client_user_decorator_1.ClientUser)()),
    __param(1, (0, common_1.Param)('outboundId', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ClientReturnsController.prototype, "getOutboundQuota", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, client_user_decorator_1.ClientUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ClientReturnsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, client_user_decorator_1.ClientUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_return_order_dto_1.CreateReturnOrderDto]),
    __metadata("design:returntype", void 0)
], ClientReturnsController.prototype, "create", null);
exports.ClientReturnsController = ClientReturnsController = __decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.UseGuards)(jwt_client_auth_guard_1.JwtClientAuthGuard),
    (0, common_1.Controller)('client/returns'),
    __metadata("design:paramtypes", [client_returns_service_1.ClientReturnsService])
], ClientReturnsController);
//# sourceMappingURL=client-returns.controller.js.map