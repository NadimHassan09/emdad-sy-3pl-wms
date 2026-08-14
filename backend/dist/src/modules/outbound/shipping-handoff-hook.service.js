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
var ShippingHandoffHookService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShippingHandoffHookService = void 0;
const common_1 = require("@nestjs/common");
const shipping_service_1 = require("../shipping/shipping.service");
let ShippingHandoffHookService = ShippingHandoffHookService_1 = class ShippingHandoffHookService {
    shipping;
    logger = new common_1.Logger(ShippingHandoffHookService_1.name);
    constructor(shipping) {
        this.shipping = shipping;
    }
    async onReadyForShipping(orderId) {
        try {
            await this.shipping.ensureShipmentForOutbound(orderId);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.error(`onReadyForShipping(${orderId}) failed: ${msg}`);
        }
    }
};
exports.ShippingHandoffHookService = ShippingHandoffHookService;
exports.ShippingHandoffHookService = ShippingHandoffHookService = ShippingHandoffHookService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [shipping_service_1.ShippingService])
], ShippingHandoffHookService);
//# sourceMappingURL=shipping-handoff-hook.service.js.map