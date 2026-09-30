"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShippingModule = void 0;
const common_1 = require("@nestjs/common");
const crypto_module_1 = require("../../common/crypto/crypto.module");
const prisma_module_1 = require("../../common/prisma/prisma.module");
const auth_module_1 = require("../auth/auth.module");
const realtime_module_1 = require("../realtime/realtime.module");
const inventory_module_1 = require("../inventory/inventory.module");
const cod_module_1 = require("../cod/cod.module");
const bulk_shipping_service_1 = require("./bulk-shipping.service");
const address_resolve_service_1 = require("./address-resolve.service");
const babel_address_adapter_1 = require("./providers/babel-express/babel-address.adapter");
const babel_express_adapter_1 = require("./providers/babel-express/babel-express.adapter");
const babel_express_http_client_1 = require("./providers/babel-express/babel-express.http-client");
const babel_geo_sync_service_1 = require("./providers/babel-express/babel-geo-sync.service");
const sila_sy_adapter_1 = require("./providers/sila-sy/sila-sy.adapter");
const sila_sy_http_client_1 = require("./providers/sila-sy/sila-sy.http-client");
const shipping_controller_1 = require("./shipping.controller");
const shipping_webhook_controller_1 = require("./shipping-webhook.controller");
const shipping_geo_service_1 = require("./shipping-geo.service");
const shipping_provider_registry_1 = require("./shipping-provider.registry");
const shipping_service_1 = require("./shipping.service");
const shipping_auto_return_service_1 = require("./shipping-auto-return.service");
const shipping_tracking_service_1 = require("./shipping-tracking.service");
const shipping_sync_scheduler_1 = require("./shipping-sync.scheduler");
let ShippingModule = class ShippingModule {
};
exports.ShippingModule = ShippingModule;
exports.ShippingModule = ShippingModule = __decorate([
    (0, common_1.Module)({
        imports: [
            prisma_module_1.PrismaModule,
            crypto_module_1.CryptoModule,
            auth_module_1.AuthModule,
            realtime_module_1.RealtimeModule,
            inventory_module_1.InventoryModule,
            cod_module_1.CodModule,
        ],
        controllers: [shipping_controller_1.ShippingController, shipping_webhook_controller_1.ShippingWebhookController],
        providers: [
            babel_express_http_client_1.BabelExpressHttpClient,
            babel_express_adapter_1.BabelExpressAdapter,
            babel_address_adapter_1.BabelAddressAdapter,
            babel_geo_sync_service_1.BabelGeoSyncService,
            sila_sy_http_client_1.SilaSyHttpClient,
            sila_sy_adapter_1.SilaSyAdapter,
            address_resolve_service_1.AddressResolveService,
            shipping_provider_registry_1.ShippingProviderRegistry,
            shipping_geo_service_1.ShippingGeoService,
            shipping_service_1.ShippingService,
            bulk_shipping_service_1.BulkShippingService,
            shipping_auto_return_service_1.ShippingAutoReturnService,
            shipping_tracking_service_1.ShippingTrackingService,
            shipping_sync_scheduler_1.ShippingSyncScheduler,
        ],
        exports: [
            shipping_service_1.ShippingService,
            shipping_provider_registry_1.ShippingProviderRegistry,
            bulk_shipping_service_1.BulkShippingService,
            shipping_geo_service_1.ShippingGeoService,
            babel_geo_sync_service_1.BabelGeoSyncService,
            babel_express_adapter_1.BabelExpressAdapter,
            babel_address_adapter_1.BabelAddressAdapter,
            sila_sy_adapter_1.SilaSyAdapter,
            address_resolve_service_1.AddressResolveService,
            shipping_auto_return_service_1.ShippingAutoReturnService,
            shipping_tracking_service_1.ShippingTrackingService,
        ],
    })
], ShippingModule);
//# sourceMappingURL=shipping.module.js.map