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
exports.ExternalOmsController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const throttler_1 = require("@nestjs/throttler");
const public_decorator_1 = require("../../../common/auth/public.decorator");
const parse_uuid_loose_pipe_1 = require("../../../common/pipes/parse-uuid-loose.pipe");
const client_user_decorator_1 = require("../auth/client-user.decorator");
const api_key_guard_1 = require("./api-key.guard");
const external_create_oms_order_dto_1 = require("./dto/external-create-oms-order.dto");
const external_oms_service_1 = require("./external-oms.service");
const require_api_scope_decorator_1 = require("./require-api-scope.decorator");
let ExternalOmsController = class ExternalOmsController {
    oms;
    constructor(oms) {
        this.oms = oms;
    }
    create(client, dto) {
        return this.oms.create(client, dto);
    }
    async findByExternal(client, externalOrderId) {
        if (!externalOrderId?.trim()) {
            throw new common_1.BadRequestException({
                code: 'VALIDATION_ERROR',
                message: 'Provide externalOrderId to look up an order.',
                fields: { externalOrderId: 'Required' },
            });
        }
        const order = await this.oms.findByExternalOrderId(client, externalOrderId);
        if (!order)
            throw new common_1.NotFoundException('Order not found.');
        return order;
    }
    findOne(client, id) {
        return this.oms.findOne(client, id);
    }
};
exports.ExternalOmsController = ExternalOmsController;
__decorate([
    (0, common_1.Post)('orders'),
    __param(0, (0, client_user_decorator_1.ClientUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, external_create_oms_order_dto_1.ExternalCreateOmsOrderDto]),
    __metadata("design:returntype", void 0)
], ExternalOmsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)('orders'),
    __param(0, (0, client_user_decorator_1.ClientUser)()),
    __param(1, (0, common_1.Query)('externalOrderId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ExternalOmsController.prototype, "findByExternal", null);
__decorate([
    (0, common_1.Get)('orders/:id'),
    __param(0, (0, client_user_decorator_1.ClientUser)()),
    __param(1, (0, common_1.Param)('id', parse_uuid_loose_pipe_1.ParseUuidLoosePipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ExternalOmsController.prototype, "findOne", null);
exports.ExternalOmsController = ExternalOmsController = __decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.UseGuards)(api_key_guard_1.ApiKeyGuard),
    (0, require_api_scope_decorator_1.RequireApiScope)(client_1.ApiCredentialScope.oms),
    (0, throttler_1.Throttle)({ default: { limit: 60, ttl: 60_000 } }),
    (0, common_1.Controller)('v1/oms'),
    __metadata("design:paramtypes", [external_oms_service_1.ExternalOmsService])
], ExternalOmsController);
//# sourceMappingURL=external-oms.controller.js.map