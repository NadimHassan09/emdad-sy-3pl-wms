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
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const client_1 = require("@prisma/client");
const auth_groups_1 = require("../../common/auth/auth-groups");
const current_user_decorator_1 = require("../../common/auth/current-user.decorator");
const internal_admin_guard_1 = require("../../common/auth/internal-admin.guard");
const roles_decorator_1 = require("../../common/auth/roles.decorator");
const roles_guard_1 = require("../../common/auth/roles.guard");
const encryption_service_1 = require("../../common/crypto/encryption.service");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const bulk_shipping_service_1 = require("./bulk-shipping.service");
const address_resolve_service_1 = require("./address-resolve.service");
const bulk_shipping_dto_1 = require("./dto/bulk-shipping.dto");
const connect_shipping_provider_dto_1 = require("./dto/connect-shipping-provider.dto");
const register_shipping_webhook_dto_1 = require("./dto/register-shipping-webhook.dto");
const upsert_shipping_fx_dto_1 = require("./dto/upsert-shipping-fx.dto");
const upsert_shipping_origin_address_dto_1 = require("./dto/upsert-shipping-origin-address.dto");
const quote_shipping_rates_dto_1 = require("./dto/quote-shipping-rates.dto");
const resolve_address_from_pin_dto_1 = require("./dto/resolve-address-from-pin.dto");
const resolve_address_from_names_dto_1 = require("./dto/resolve-address-from-names.dto");
const babel_express_adapter_1 = require("./providers/babel-express/babel-express.adapter");
const babel_geo_sync_service_1 = require("./providers/babel-express/babel-geo-sync.service");
const shipping_constants_1 = require("./shipping.constants");
const shipping_fx_service_1 = require("./shipping-fx.service");
const shipping_service_1 = require("./shipping.service");
const shipping_fee_service_1 = require("./shipping-fee.service");
const shipping_tracking_service_1 = require("./shipping-tracking.service");
const shipping_provider_registry_1 = require("./shipping-provider.registry");
const STAGING_WEBHOOK_HOSTS = new Set(['staging-admin.emdadsy.com', 'staging-client.emdadsy.com']);
function assertStagingWebhookUrl(webhookUrl, providerCode) {
    let parsed;
    try {
        parsed = new URL(webhookUrl);
    }
    catch {
        return 'Webhook URL is not valid.';
    }
    if (parsed.protocol !== 'https:') {
        return 'Webhook URL must use HTTPS.';
    }
    if (!STAGING_WEBHOOK_HOSTS.has(parsed.hostname.toLowerCase())) {
        return 'Webhook URL must be a staging host (staging-admin.emdadsy.com or staging-client.emdadsy.com).';
    }
    const expectedPath = `/api/shipping/webhooks/${providerCode}`;
    if (parsed.pathname.replace(/\/+$/, '') !== expectedPath) {
        return `Webhook path must be ${expectedPath}.`;
    }
    return null;
}
class ResolveBabelNeighbourhoodDto {
    lat;
    lng;
}
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], ResolveBabelNeighbourhoodDto.prototype, "lat", void 0);
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], ResolveBabelNeighbourhoodDto.prototype, "lng", void 0);
let ShippingController = class ShippingController {
    shipping;
    fx;
    bulkShipping;
    babelGeo;
    babelAdapter;
    addressResolve;
    prisma;
    encryption;
    tracking;
    registry;
    fees;
    constructor(shipping, fx, bulkShipping, babelGeo, babelAdapter, addressResolve, prisma, encryption, tracking, registry, fees) {
        this.shipping = shipping;
        this.fx = fx;
        this.bulkShipping = bulkShipping;
        this.babelGeo = babelGeo;
        this.babelAdapter = babelAdapter;
        this.addressResolve = addressResolve;
        this.prisma = prisma;
        this.encryption = encryption;
        this.tracking = tracking;
        this.registry = registry;
        this.fees = fees;
    }
    carrierCosts(omsOrderId) {
        return this.fees.carrierCostHistoryForOrder(omsOrderId);
    }
    listProviders() {
        return this.shipping.listProviders();
    }
    getFx() {
        return this.fx.getSettings();
    }
    async saveFx(body, user) {
        if (user.role !== 'super_admin') {
            throw new common_1.ForbiddenException('Only a super admin can set the USD/SYP rate.');
        }
        const thresholds = {
            refreshHours: body.refreshHours,
            staleHours: body.staleHours,
            minChangePercent: body.minChangePercent,
        };
        if (body.mode === 'automatic') {
            await this.fx.saveThresholds(thresholds, user);
            return this.fx.saveAutomatic(user);
        }
        if (body.manualRate == null) {
            await this.fx.saveThresholds(thresholds, user);
            throw new common_1.BadRequestException('Enter the manual USD to SYP rate.');
        }
        await this.fx.saveThresholds(thresholds, user);
        return this.fx.saveManual(body.manualRate, user);
    }
    testFxSource(user) {
        if (user.role !== 'super_admin') {
            throw new common_1.ForbiddenException('Only a super admin can test the exchange-rate source.');
        }
        return this.fx.testSource();
    }
    getOriginAddress() {
        return this.shipping.getOriginAddress();
    }
    saveOriginAddress(body, user) {
        if (user.role !== 'super_admin') {
            throw new common_1.ForbiddenException('Only a super admin can set the pickup address.');
        }
        return this.shipping.saveOriginAddress(body, user.id);
    }
    connect(code, body, user) {
        return this.shipping.connectProvider(code.toUpperCase(), body.username, body.password, user.id, body.webhookSecret);
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
    syncBabelGeo() {
        return this.babelGeo.syncFromBabel();
    }
    babelGeoMeta() {
        return this.babelGeo.snapshotMeta();
    }
    babelCities() {
        return this.babelGeo.listCities();
    }
    babelAreas(cityId) {
        return this.babelGeo.listAreas(Number(cityId));
    }
    babelNeighbourhoods(areaId) {
        return this.babelGeo.listNeighbourhoods(Number(areaId));
    }
    resolveAddressFromPin(body) {
        return this.addressResolve.resolveFromPin(body.lat, body.lng);
    }
    resolveAddressFromNames(body) {
        return this.addressResolve.resolveFromAddress({
            governorate: body.governorate,
            cityRegion: body.cityRegion,
            townNeighborhood: body.townNeighborhood,
        });
    }
    async resolveNeighbourhood(body) {
        const credentials = await this.requireBabelCredentials();
        const found = await this.babelAdapter.findNeighbourhoodByCoordinates(credentials, body.lat, body.lng);
        if (!found) {
            return { found: false, neighbourhood: null };
        }
        return { found: true, neighbourhood: found };
    }
    quoteRates(body) {
        return this.shipping.quoteDestinationRates(body);
    }
    retry(outboundOrderId, body) {
        return this.shipping.retryShipment(outboundOrderId, {
            acknowledgeNoExternalShipment: body?.acknowledgeNoExternalShipment === true,
        });
    }
    async syncTracking(outboundOrderId) {
        const shipment = await this.prisma.carrierShipment.findFirst({
            where: { outboundOrderId },
            select: { externalAwb: true, providerCode: true },
        });
        if (!shipment || !shipment.externalAwb) {
            return { success: false, message: 'No carrier shipment with an AWB found for this order.' };
        }
        return this.tracking.syncShipmentByAwb(shipment.externalAwb, shipment.providerCode);
    }
    async registerWebhook(providerCode, body) {
        const code = providerCode.toUpperCase().trim();
        if (code === shipping_constants_1.SENA_EXPRESS_CODE) {
            const secret = body.secret?.trim();
            if (!secret) {
                return { ok: false, message: 'Webhook secret is required.' };
            }
            const connection = await this.prisma.shippingProviderConnection.findFirst({
                where: { provider: { code } },
            });
            if (!connection) {
                return { ok: false, message: `Provider ${code} is not connected.` };
            }
            await this.prisma.shippingProviderConnection.update({
                where: { id: connection.id },
                data: { webhookSecret: secret },
            });
            return {
                ok: true,
                secretSaved: true,
                secretPrefix: `${secret.slice(0, 6)}…`,
                message: 'SENA Express webhook secret saved successfully.',
            };
        }
        const adapter = this.registry.get(code);
        if (!adapter || !adapter.registerWebhook) {
            return { ok: false, message: `Provider ${code} does not support automatic webhook registration.` };
        }
        const webhookUrl = (body.webhookUrl || '').trim();
        const urlError = assertStagingWebhookUrl(webhookUrl, code);
        if (urlError) {
            return { ok: false, message: urlError };
        }
        const connection = await this.prisma.shippingProviderConnection.findFirst({
            where: { provider: { code } },
        });
        if (!connection || connection.status !== 'connected' || !connection.encryptedUsername) {
            return { ok: false, message: `Provider ${code} is not connected.` };
        }
        const credentials = {
            username: this.encryption.decrypt(connection.encryptedUsername),
            password: connection.encryptedPassword ? this.encryption.decrypt(connection.encryptedPassword) : '',
        };
        const requestedSecret = body.secret?.trim() || '';
        const existingSecret = connection.webhookSecret?.trim() || '';
        const registerSecret = code === shipping_constants_1.BABEL_EXPRESS_CODE
            ? requestedSecret.length >= 32
                ? requestedSecret
                : existingSecret.length >= 32
                    ? existingSecret
                    : ''
            : requestedSecret;
        const result = await adapter.registerWebhook(credentials, webhookUrl, registerSecret);
        if (!result.ok)
            return { ok: false, message: result.message };
        const webhookSecret = result.secret || body.secret?.trim() || '';
        if (webhookSecret) {
            await this.prisma.shippingProviderConnection.update({
                where: { id: connection.id },
                data: { webhookSecret },
            });
        }
        let testPing;
        if (result.webhookId && adapter.testRegisteredWebhook) {
            testPing = await adapter.testRegisteredWebhook(credentials, result.webhookId);
        }
        return {
            ok: true,
            webhookId: result.webhookId,
            secretSaved: Boolean(webhookSecret),
            secretPrefix: webhookSecret ? `${webhookSecret.slice(0, 6)}…` : null,
            testPing,
            message: result.message,
        };
    }
    refreshSilaAwb(outboundOrderId) {
        return this.tracking.refreshSilaCarrierIdentifiers(outboundOrderId);
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
    retryItem(id, outboundOrderId, body) {
        return this.bulkShipping.retryItem(id, outboundOrderId, {
            acknowledgeNoExternalShipment: body?.acknowledgeNoExternalShipment === true,
        });
    }
    getLabels(id) {
        return this.bulkShipping.getLabelsForJob(id);
    }
    async requireBabelCredentials() {
        const provider = await this.prisma.shippingProvider.findUnique({
            where: { code: shipping_constants_1.BABEL_EXPRESS_CODE },
            include: { connection: true },
        });
        const conn = provider?.connection;
        if (!conn ||
            conn.status !== client_1.ShippingProviderConnectionStatus.connected ||
            !conn.encryptedUsername ||
            !conn.encryptedPassword) {
            throw new Error('Babel Express is not connected.');
        }
        return {
            username: this.encryption.decrypt(conn.encryptedUsername),
            password: this.encryption.decrypt(conn.encryptedPassword),
        };
    }
};
exports.ShippingController = ShippingController;
__decorate([
    (0, common_1.Get)('orders/:omsOrderId/carrier-costs'),
    __param(0, (0, common_1.Param)('omsOrderId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ShippingController.prototype, "carrierCosts", null);
__decorate([
    (0, common_1.Get)('providers'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ShippingController.prototype, "listProviders", null);
__decorate([
    (0, common_1.Get)('fx'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ShippingController.prototype, "getFx", null);
__decorate([
    (0, common_1.Put)('fx'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [upsert_shipping_fx_dto_1.UpsertShippingFxDto, Object]),
    __metadata("design:returntype", Promise)
], ShippingController.prototype, "saveFx", null);
__decorate([
    (0, common_1.Post)('fx/test-source'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ShippingController.prototype, "testFxSource", null);
__decorate([
    (0, common_1.Get)('origin-address'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ShippingController.prototype, "getOriginAddress", null);
__decorate([
    (0, common_1.Put)('origin-address'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [upsert_shipping_origin_address_dto_1.UpsertShippingOriginAddressDto, Object]),
    __metadata("design:returntype", void 0)
], ShippingController.prototype, "saveOriginAddress", null);
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
    (0, common_1.Post)('babel/geo/sync'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ShippingController.prototype, "syncBabelGeo", null);
__decorate([
    (0, common_1.Get)('babel/geo/meta'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ShippingController.prototype, "babelGeoMeta", null);
__decorate([
    (0, common_1.Get)('babel/geo/cities'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ShippingController.prototype, "babelCities", null);
__decorate([
    (0, common_1.Get)('babel/geo/cities/:cityId/areas'),
    __param(0, (0, common_1.Param)('cityId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ShippingController.prototype, "babelAreas", null);
__decorate([
    (0, common_1.Get)('babel/geo/areas/:areaId/neighbourhoods'),
    __param(0, (0, common_1.Param)('areaId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ShippingController.prototype, "babelNeighbourhoods", null);
__decorate([
    (0, common_1.Post)('address/resolve-from-pin'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [resolve_address_from_pin_dto_1.ResolveAddressFromPinDto]),
    __metadata("design:returntype", void 0)
], ShippingController.prototype, "resolveAddressFromPin", null);
__decorate([
    (0, common_1.Post)('address/resolve-from-names'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [resolve_address_from_names_dto_1.ResolveAddressFromNamesDto]),
    __metadata("design:returntype", void 0)
], ShippingController.prototype, "resolveAddressFromNames", null);
__decorate([
    (0, common_1.Post)('babel/resolve-neighbourhood'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ResolveBabelNeighbourhoodDto]),
    __metadata("design:returntype", Promise)
], ShippingController.prototype, "resolveNeighbourhood", null);
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
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], ShippingController.prototype, "retry", null);
__decorate([
    (0, common_1.Post)('shipments/:outboundOrderId/sync-tracking'),
    __param(0, (0, common_1.Param)('outboundOrderId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ShippingController.prototype, "syncTracking", null);
__decorate([
    (0, common_1.Post)('providers/:providerCode/register-webhook'),
    __param(0, (0, common_1.Param)('providerCode')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, register_shipping_webhook_dto_1.RegisterShippingWebhookDto]),
    __metadata("design:returntype", Promise)
], ShippingController.prototype, "registerWebhook", null);
__decorate([
    (0, common_1.Post)('shipments/:outboundOrderId/refresh-sila-awb'),
    __param(0, (0, common_1.Param)('outboundOrderId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ShippingController.prototype, "refreshSilaAwb", null);
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
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
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
        shipping_fx_service_1.ShippingFxService,
        bulk_shipping_service_1.BulkShippingService,
        babel_geo_sync_service_1.BabelGeoSyncService,
        babel_express_adapter_1.BabelExpressAdapter,
        address_resolve_service_1.AddressResolveService,
        prisma_service_1.PrismaService,
        encryption_service_1.EncryptionService,
        shipping_tracking_service_1.ShippingTrackingService,
        shipping_provider_registry_1.ShippingProviderRegistry,
        shipping_fee_service_1.ShippingFeeService])
], ShippingController);
//# sourceMappingURL=shipping.controller.js.map