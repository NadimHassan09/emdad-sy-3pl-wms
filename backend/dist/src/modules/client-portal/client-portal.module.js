"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientPortalModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
const passport_1 = require("@nestjs/passport");
const crypto_module_1 = require("../../common/crypto/crypto.module");
const prisma_module_1 = require("../../common/prisma/prisma.module");
const inbound_module_1 = require("../inbound/inbound.module");
const inventory_module_1 = require("../inventory/inventory.module");
const outbound_module_1 = require("../outbound/outbound.module");
const products_module_1 = require("../products/products.module");
const client_auth_controller_1 = require("./auth/client-auth.controller");
const client_auth_service_1 = require("./auth/client-auth.service");
const jwt_client_auth_guard_1 = require("./auth/jwt-client-auth.guard");
const jwt_client_strategy_1 = require("./auth/strategies/jwt-client.strategy");
const client_inbound_orders_controller_1 = require("./inbound/client-inbound-orders.controller");
const client_inbound_orders_service_1 = require("./inbound/client-inbound-orders.service");
const client_outbound_orders_controller_1 = require("./outbound/client-outbound-orders.controller");
const client_outbound_orders_service_1 = require("./outbound/client-outbound-orders.service");
const client_products_controller_1 = require("./products/client-products.controller");
const client_products_service_1 = require("./products/client-products.service");
const client_stock_controller_1 = require("./stock/client-stock.controller");
const client_stock_service_1 = require("./stock/client-stock.service");
let ClientPortalModule = class ClientPortalModule {
};
exports.ClientPortalModule = ClientPortalModule;
exports.ClientPortalModule = ClientPortalModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule,
            passport_1.PassportModule.register({}),
            jwt_1.JwtModule.registerAsync({
                imports: [config_1.ConfigModule],
                inject: [config_1.ConfigService],
                useFactory: (config) => ({
                    secret: config.get('CLIENT_JWT_SECRET') ??
                        config.get('JWT_SECRET') ??
                        'dev-only-change-in-production',
                    signOptions: { expiresIn: 8 * 60 * 60 },
                }),
            }),
            prisma_module_1.PrismaModule,
            crypto_module_1.CryptoModule,
            inventory_module_1.InventoryModule,
            products_module_1.ProductsModule,
            inbound_module_1.InboundModule,
            outbound_module_1.OutboundModule,
        ],
        controllers: [
            client_auth_controller_1.ClientAuthController,
            client_stock_controller_1.ClientStockController,
            client_products_controller_1.ClientProductsController,
            client_inbound_orders_controller_1.ClientInboundOrdersController,
            client_outbound_orders_controller_1.ClientOutboundOrdersController,
        ],
        providers: [
            client_auth_service_1.ClientAuthService,
            client_stock_service_1.ClientStockService,
            client_products_service_1.ClientProductsService,
            client_inbound_orders_service_1.ClientInboundOrdersService,
            client_outbound_orders_service_1.ClientOutboundOrdersService,
            jwt_client_strategy_1.JwtClientStrategy,
            jwt_client_auth_guard_1.JwtClientAuthGuard,
        ],
        exports: [client_auth_service_1.ClientAuthService],
    })
], ClientPortalModule);
//# sourceMappingURL=client-portal.module.js.map