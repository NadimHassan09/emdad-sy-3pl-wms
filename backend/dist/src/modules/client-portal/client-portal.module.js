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
const media_module_1 = require("../media/media.module");
const outbound_module_1 = require("../outbound/outbound.module");
const products_module_1 = require("../products/products.module");
const billing_module_1 = require("../billing/billing.module");
const oms_module_1 = require("../oms/oms.module");
const oms_returns_module_1 = require("../oms-returns/oms-returns.module");
const returns_module_1 = require("../returns/returns.module");
const shipping_module_1 = require("../shipping/shipping.module");
const pdf_module_1 = require("../../pdf/pdf.module");
const api_credentials_controller_1 = require("./api-credentials/api-credentials.controller");
const api_credentials_service_1 = require("./api-credentials/api-credentials.service");
const api_docs_service_1 = require("./external-api/api-docs.service");
const api_key_guard_1 = require("./external-api/api-key.guard");
const external_inbound_controller_1 = require("./external-api/external-inbound.controller");
const external_inbound_service_1 = require("./external-api/external-inbound.service");
const external_oms_controller_1 = require("./external-api/external-oms.controller");
const external_oms_service_1 = require("./external-api/external-oms.service");
const external_outbound_controller_1 = require("./external-api/external-outbound.controller");
const external_outbound_service_1 = require("./external-api/external-outbound.service");
const client_auth_controller_1 = require("./auth/client-auth.controller");
const client_auth_service_1 = require("./auth/client-auth.service");
const jwt_client_auth_guard_1 = require("./auth/jwt-client-auth.guard");
const jwt_client_strategy_1 = require("./auth/strategies/jwt-client.strategy");
const client_inbound_orders_controller_1 = require("./inbound/client-inbound-orders.controller");
const client_inbound_orders_service_1 = require("./inbound/client-inbound-orders.service");
const client_media_controller_1 = require("./media/client-media.controller");
const client_outbound_orders_controller_1 = require("./outbound/client-outbound-orders.controller");
const client_outbound_orders_service_1 = require("./outbound/client-outbound-orders.service");
const client_products_controller_1 = require("./products/client-products.controller");
const client_products_service_1 = require("./products/client-products.service");
const client_notifications_controller_1 = require("./notifications/client-notifications.controller");
const client_notifications_service_1 = require("./notifications/client-notifications.service");
const client_stock_controller_1 = require("./stock/client-stock.controller");
const client_stock_service_1 = require("./stock/client-stock.service");
const client_billing_controller_1 = require("./billing/client-billing.controller");
const client_billing_service_1 = require("./billing/client-billing.service");
const client_dashboard_controller_1 = require("./dashboard/client-dashboard.controller");
const client_dashboard_service_1 = require("./dashboard/client-dashboard.service");
const client_oms_orders_controller_1 = require("./oms/client-oms-orders.controller");
const client_oms_orders_service_1 = require("./oms/client-oms-orders.service");
const inbound_client_import_service_1 = require("./order-import/inbound-client-import.service");
const oms_client_import_service_1 = require("./order-import/oms-client-import.service");
const outbound_client_import_service_1 = require("./order-import/outbound-client-import.service");
const client_returns_controller_1 = require("./returns/client-returns.controller");
const client_returns_service_1 = require("./returns/client-returns.service");
const client_oms_returns_controller_1 = require("./oms-returns/client-oms-returns.controller");
const client_oms_returns_service_1 = require("./oms-returns/client-oms-returns.service");
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
            media_module_1.MediaModule,
            inbound_module_1.InboundModule,
            outbound_module_1.OutboundModule,
            billing_module_1.BillingModule,
            oms_module_1.OmsModule,
            oms_returns_module_1.OmsReturnsModule,
            returns_module_1.ReturnsModule,
            shipping_module_1.ShippingModule,
            pdf_module_1.PdfModule,
        ],
        controllers: [
            client_auth_controller_1.ClientAuthController,
            client_stock_controller_1.ClientStockController,
            client_products_controller_1.ClientProductsController,
            client_media_controller_1.ClientMediaController,
            client_inbound_orders_controller_1.ClientInboundOrdersController,
            client_outbound_orders_controller_1.ClientOutboundOrdersController,
            client_notifications_controller_1.ClientNotificationsController,
            client_billing_controller_1.ClientBillingController,
            client_dashboard_controller_1.ClientDashboardController,
            client_oms_orders_controller_1.ClientOmsOrdersController,
            client_oms_returns_controller_1.ClientOmsReturnsController,
            client_returns_controller_1.ClientReturnsController,
            api_credentials_controller_1.ApiCredentialsController,
            external_oms_controller_1.ExternalOmsController,
            external_inbound_controller_1.ExternalInboundController,
            external_outbound_controller_1.ExternalOutboundController,
        ],
        providers: [
            client_auth_service_1.ClientAuthService,
            client_stock_service_1.ClientStockService,
            client_products_service_1.ClientProductsService,
            client_inbound_orders_service_1.ClientInboundOrdersService,
            client_outbound_orders_service_1.ClientOutboundOrdersService,
            client_notifications_service_1.ClientNotificationsService,
            client_billing_service_1.ClientBillingService,
            client_dashboard_service_1.ClientDashboardService,
            client_oms_orders_service_1.ClientOmsOrdersService,
            oms_client_import_service_1.OmsClientImportService,
            inbound_client_import_service_1.InboundClientImportService,
            outbound_client_import_service_1.OutboundClientImportService,
            client_oms_returns_service_1.ClientOmsReturnsService,
            client_returns_service_1.ClientReturnsService,
            jwt_client_strategy_1.JwtClientStrategy,
            jwt_client_auth_guard_1.JwtClientAuthGuard,
            api_credentials_service_1.ApiCredentialsService,
            api_key_guard_1.ApiKeyGuard,
            api_docs_service_1.ApiDocsService,
            external_oms_service_1.ExternalOmsService,
            external_inbound_service_1.ExternalInboundService,
            external_outbound_service_1.ExternalOutboundService,
        ],
        exports: [client_auth_service_1.ClientAuthService],
    })
], ClientPortalModule);
//# sourceMappingURL=client-portal.module.js.map