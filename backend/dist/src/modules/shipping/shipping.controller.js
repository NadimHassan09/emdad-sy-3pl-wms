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
exports.ShippingController = void 0;
const common_1 = require("@nestjs/common");
const auth_groups_1 = require("../../common/auth/auth-groups");
const current_user_decorator_1 = require("../../common/auth/current-user.decorator");
const internal_admin_guard_1 = require("../../common/auth/internal-admin.guard");
const roles_decorator_1 = require("../../common/auth/roles.decorator");
const roles_guard_1 = require("../../common/auth/roles.guard");
const bulk_shipping_service_1 = require("./bulk-shipping.service");
const bulk_shipping_dto_1 = require("./dto/bulk-shipping.dto");
const connect_shipping_provider_dto_1 = require("./dto/connect-shipping-provider.dto");
const quote_shipping_rates_dto_1 = require("./dto/quote-shipping-rates.dto");
const shipping_service_1 = require("./shipping.service");
let ShippingController = class ShippingController {
    shipping;
    bulkShipping;
    constructor(shipping, bulkShipping) {
        this.shipping = shipping;
        this.bulkShipping = bulkShipping;
    }
    listProviders() {
        return this.shipping.listProviders();
    }
    connect(code, body, user) {
        return this.shipping.connectProvider(code.toUpperCase(), body.username, body.password, user.id);
    }
    test(code) {
        return this.shipping.testProvider(code.toUpperCase());
    }
    disconnect(code) {
        return this.shipping.disconnectProvider(code.toUpperCase());
    }
    async getBoundary(governorate, city, neighborhood) {
        const row = await this.shipping.lookupAreaBoundary({
            governorate,
            city,
            neighborhood,
        });
        if (!row) {
            return { found: false, geometry: null };
        }
        return { found: true, ...row };
    }
    quoteRates(body) {
        return this.shipping.quoteDestinationRates(body);
    }
    retry(outboundOrderId) {
        return this.shipping.retryShipment(outboundOrderId);
    }
    listEligible(companyId, limit) {
        return this.bulkShipping.listEligible({
            companyId: companyId || undefined,
            limit: limit ? Number(limit) : undefined,
        });
    }
    preview(body) {
        return this.bulkShipping.preview(body.outboundOrderIds);
    }
    confirm(body, user) {
        return this.bulkShipping.confirmAndStart(user.id, body.items);
    }
    getJob(id) {
        return this.bulkShipping.getJob(id);
    }
    retryItem(id, outboundOrderId) {
        return this.bulkShipping.retryItem(id, outboundOrderId);
    }
    getLabels(id) {
        return this.bulkShipping.getLabelsForJob(id);
    }
};
exports.ShippingController = ShippingController;
__decorate([
    (0, common_1.Get)('providers'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ShippingController.prototype, "listProviders", null);
__decorate([
    (0, common_1.Post)('providers/:code/connect'),
    __param(0, (0, common_1.Param)('code')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, connect_shipping_provider_dto_1.ConnectShippingProviderDto, Object]),
    __metadata("design:returntype", void 0)
], ShippingController.prototype, "connect", null);
__decorate([
    (0, common_1.Post)('providers/:code/test'),
    __param(0, (0, common_1.Param)('code')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ShippingController.prototype, "test", null);
__decorate([
    (0, common_1.Post)('providers/:code/disconnect'),
    __param(0, (0, common_1.Param)('code')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ShippingController.prototype, "disconnect", null);
__decorate([
    (0, common_1.Get)('geo/boundary'),
    __param(0, (0, common_1.Query)('governorate')),
    __param(1, (0, common_1.Query)('city')),
    __param(2, (0, common_1.Query)('neighborhood')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], ShippingController.prototype, "getBoundary", null);
__decorate([
    (0, common_1.Post)('rates'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [quote_shipping_rates_dto_1.QuoteShippingRatesDto]),
    __metadata("design:returntype", void 0)
], ShippingController.prototype, "quoteRates", null);
__decorate([
    (0, common_1.Post)('shipments/:outboundOrderId/retry'),
    __param(0, (0, common_1.Param)('outboundOrderId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ShippingController.prototype, "retry", null);
__decorate([
    (0, common_1.Get)('bulk/eligible'),
    __param(0, (0, common_1.Query)('companyId')),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], ShippingController.prototype, "listEligible", null);
__decorate([
    (0, common_1.Post)('bulk/preview'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [bulk_shipping_dto_1.BulkShippingPreviewDto]),
    __metadata("design:returntype", void 0)
], ShippingController.prototype, "preview", null);
__decorate([
    (0, common_1.Post)('bulk/jobs'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [bulk_shipping_dto_1.BulkShippingConfirmDto, Object]),
    __metadata("design:returntype", void 0)
], ShippingController.prototype, "confirm", null);
__decorate([
    (0, common_1.Get)('bulk/jobs/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ShippingController.prototype, "getJob", null);
__decorate([
    (0, common_1.Post)('bulk/jobs/:id/items/:outboundOrderId/retry'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('outboundOrderId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], ShippingController.prototype, "retryItem", null);
__decorate([
    (0, common_1.Get)('bulk/jobs/:id/labels'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ShippingController.prototype, "getLabels", null);
exports.ShippingController = ShippingController = __decorate([
    (0, common_1.Controller)('shipping'),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard, internal_admin_guard_1.InternalAdminGuard),
    (0, roles_decorator_1.Roles)(auth_groups_1.AuthGroup.ADMIN),
    __metadata("design:paramtypes", [shipping_service_1.ShippingService,
        bulk_shipping_service_1.BulkShippingService])
], ShippingController);
//# sourceMappingURL=shipping.controller.js.map