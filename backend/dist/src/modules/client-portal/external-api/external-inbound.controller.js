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
exports.ExternalInboundController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const throttler_1 = require("@nestjs/throttler");
const public_decorator_1 = require("../../../common/auth/public.decorator");
const client_user_decorator_1 = require("../auth/client-user.decorator");
const api_key_guard_1 = require("./api-key.guard");
const external_create_inbound_order_dto_1 = require("./dto/external-create-inbound-order.dto");
const external_list_orders_query_dto_1 = require("./dto/external-list-orders-query.dto");
const external_inbound_service_1 = require("./external-inbound.service");
const require_api_scope_decorator_1 = require("./require-api-scope.decorator");
let ExternalInboundController = class ExternalInboundController {
    inbound;
    constructor(inbound) {
        this.inbound = inbound;
    }
    create(client, dto) {
        return this.inbound.create(client, dto);
    }
    async listOrFind(client, query) {
        if (query.externalOrderId?.trim() || query.orderNumber?.trim()) {
            const order = await this.inbound.findOneByLookup(client, {
                externalOrderId: query.externalOrderId,
                orderNumber: query.orderNumber,
            });
            if (!order)
                throw new common_1.NotFoundException('Order not found.');
            return order;
        }
        return this.inbound.list(client, query);
    }
    async findOne(client, idOrNumber) {
        const order = await this.inbound.findOneByLookup(client, { idOrNumber });
        if (!order)
            throw new common_1.NotFoundException('Order not found.');
        return order;
    }
};
exports.ExternalInboundController = ExternalInboundController;
__decorate([
    (0, common_1.Post)('orders'),
    __param(0, (0, client_user_decorator_1.ClientUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, external_create_inbound_order_dto_1.ExternalCreateInboundOrderDto]),
    __metadata("design:returntype", void 0)
], ExternalInboundController.prototype, "create", null);
__decorate([
    (0, common_1.Get)('orders'),
    __param(0, (0, client_user_decorator_1.ClientUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, external_list_orders_query_dto_1.ExternalListInboundOrdersQueryDto]),
    __metadata("design:returntype", Promise)
], ExternalInboundController.prototype, "listOrFind", null);
__decorate([
    (0, common_1.Get)('orders/:idOrNumber'),
    __param(0, (0, client_user_decorator_1.ClientUser)()),
    __param(1, (0, common_1.Param)('idOrNumber')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ExternalInboundController.prototype, "findOne", null);
exports.ExternalInboundController = ExternalInboundController = __decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.UseGuards)(api_key_guard_1.ApiKeyGuard),
    (0, require_api_scope_decorator_1.RequireApiScope)(client_1.ApiCredentialScope.inbound),
    (0, throttler_1.Throttle)({ default: { limit: 60, ttl: 60_000 } }),
    (0, common_1.Controller)('v1/inbound'),
    __metadata("design:paramtypes", [external_inbound_service_1.ExternalInboundService])
], ExternalInboundController);
//# sourceMappingURL=external-inbound.controller.js.map