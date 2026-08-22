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
var ShippingService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShippingService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const encryption_service_1 = require("../../common/crypto/encryption.service");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const realtime_service_1 = require("../realtime/realtime.service");
const oms_order_mapper_1 = require("../oms/oms-order.mapper");
const babel_address_adapter_1 = require("./providers/babel-express/babel-address.adapter");
const babel_express_http_client_1 = require("./providers/babel-express/babel-express.http-client");
const babel_shipment_mapper_1 = require("./providers/babel-express/babel-shipment.mapper");
const shipping_provider_registry_1 = require("./shipping-provider.registry");
const shipping_config_util_1 = require("./shipping-config.util");
const shipping_geo_service_1 = require("./shipping-geo.service");
const shipping_rate_util_1 = require("./shipping-rate.util");
const shipment_parts_util_1 = require("./shipment-parts.util");
function maskUsername(username) {
    if (!username)
        return null;
    if (username.length <= 2)
        return '*'.repeat(username.length);
    return `${username.slice(0, 2)}${'*'.repeat(Math.min(8, username.length - 2))}`;
}
function safeErrorMessage(err) {
    const raw = err instanceof babel_express_http_client_1.BabelApiError
        ? err.message
        : err instanceof Error
            ? err.message
            : 'Shipping provider request failed.';
    const msg = raw.slice(0, 500);
    if (/no shipping service available/i.test(msg)) {
        return `${msg} Usually the package weight is too high (use real kg, max ~200), or the pin is outside Babel coverage, or delivery/pickup type is wrong.`;
    }
    return msg;
}
function publicCarrierRateError(safe) {
    const msg = safe.trim().slice(0, 500);
    if (/no shipping service available/i.test(msg)) {
        return 'This carrier does not currently serve this destination or shipment.';
    }
    if (msg &&
        !/unauthorized|password|credential|decrypt|token|secret/i.test(msg)) {
        return msg;
    }
    return 'Unable to retrieve rates right now.';
}
function deliveryTypeLabel(type) {
    if (type === 'hub')
        return 'Hub';
    if (type === 'address')
        return 'Address';
    return type;
}
function roundCoord(n) {
    return Math.round(n * 1e5) / 1e5;
}
let ShippingService = ShippingService_1 = class ShippingService {
    prisma;
    encryption;
    registry;
    realtime;
    geo;
    babelAddress;
    logger = new common_1.Logger(ShippingService_1.name);
    constructor(prisma, encryption, registry, realtime, geo, babelAddress) {
        this.prisma = prisma;
        this.encryption = encryption;
        this.registry = registry;
        this.realtime = realtime;
        this.geo = geo;
        this.babelAddress = babelAddress;
    }
    rateCache = new Map();
    async lookupAreaBoundary(params) {
        return this.geo.lookupBoundary(params);
    }
    async quoteDestinationRates(dto) {
        const cacheKey = JSON.stringify({
            lat: dto.receiverLat != null ? roundCoord(dto.receiverLat) : null,
            lng: dto.receiverLng != null ? roundCoord(dto.receiverLng) : null,
            neighbourhoodId: dto.neighbourhoodId ?? null,
            packageType: dto.packageType,
            weightKg: dto.weightKg,
            deliveryType: dto.deliveryType,
            pickupType: dto.pickupType ?? null,
            volumeCbm: dto.volumeCbm ?? null,
            gov: dto.governorate?.trim() || '',
            city: dto.city?.trim() || '',
            hood: dto.neighborhood?.trim() || '',
        });
        const cached = this.rateCache.get(cacheKey);
        if (cached && Date.now() - cached.at < 60_000) {
            return cached.value;
        }
        const hasCoords = dto.receiverLat != null &&
            dto.receiverLng != null &&
            Number.isFinite(dto.receiverLat) &&
            Number.isFinite(dto.receiverLng);
        let neighbourhoodId = dto.neighbourhoodId != null && Number.isFinite(Number(dto.neighbourhoodId))
            ? Number(dto.neighbourhoodId)
            : null;
        if (neighbourhoodId == null) {
            neighbourhoodId = await this.babelAddress.resolveNeighbourhoodId({
                governorate: dto.governorate,
                cityRegion: dto.city,
                townNeighborhood: dto.neighborhood,
            });
        }
        let inSelectedArea = null;
        if (hasCoords) {
            const boundary = await this.geo.lookupBoundary({
                governorate: dto.governorate,
                city: dto.city,
                neighborhood: dto.neighborhood,
            });
            inSelectedArea =
                boundary != null
                    ? this.geo.containsPoint(boundary, {
                        lat: dto.receiverLat,
                        lng: dto.receiverLng,
                    })
                    : null;
        }
        if (inSelectedArea === false) {
            const empty = {
                inSelectedArea: false,
                quotes: [],
                errors: [],
            };
            this.rateCache.set(cacheKey, { at: Date.now(), value: empty });
            return empty;
        }
        const providers = await this.prisma.shippingProvider.findMany({
            where: { enabled: true },
            include: { connection: true },
            orderBy: { name: 'asc' },
        });
        const quotes = [];
        const errors = [];
        await Promise.all(providers.map(async (row) => {
            const connected = row.connection?.status === client_1.ShippingProviderConnectionStatus.connected &&
                !!row.connection.encryptedUsername &&
                !!row.connection.encryptedPassword;
            if (!connected || !this.registry.has(row.code))
                return;
            const adapter = this.registry.get(row.code);
            if (!adapter.capabilities.supportsQuote)
                return;
            try {
                const credentials = {
                    username: this.encryption.decrypt(row.connection.encryptedUsername),
                    password: this.encryption.decrypt(row.connection.encryptedPassword),
                };
                const result = await adapter.getQuote(credentials, {
                    receiverLat: dto.receiverLat ?? 0,
                    receiverLng: dto.receiverLng ?? 0,
                    neighbourhoodId: neighbourhoodId ?? undefined,
                    packageType: dto.packageType,
                    weightKg: dto.packageType === 'envelope' ? 1 : dto.weightKg,
                    deliveryType: dto.deliveryType,
                    pickupType: dto.pickupType ?? 'hub',
                    volumeCbm: dto.volumeCbm ?? undefined,
                    governorate: dto.governorate,
                    city: dto.city,
                    neighborhood: dto.neighborhood,
                    codAmount: dto.codAmount ?? undefined,
                });
                const quotedDeliveryType = result.effectiveDeliveryType ?? dto.deliveryType;
                if (result.shippable === false) {
                    errors.push({
                        carrierId: row.code,
                        carrierName: row.name,
                        message: 'Not available for this destination / shipment configuration.',
                    });
                    return;
                }
                quotes.push({
                    carrierId: row.code,
                    carrierName: row.name,
                    serviceId: result.serviceId ?? `${row.code}:${quotedDeliveryType}`,
                    serviceName: result.serviceName ?? deliveryTypeLabel(quotedDeliveryType),
                    available: true,
                    price: result.price,
                    currency: result.currency || 'USD',
                    prices: result.prices && result.prices.length > 0
                        ? result.prices
                        : [{ price: result.price, currency: result.currency || 'USD' }],
                    estimatedDeliveryMin: result.estimatedDeliveryMin,
                    estimatedDeliveryMax: result.estimatedDeliveryMax,
                    deliveryType: quotedDeliveryType,
                    restrictions: result.restrictions,
                });
            }
            catch (err) {
                this.logger.warn(`Rate quote failed for ${row.code}: ${err instanceof Error ? err.message : err}`);
                errors.push({
                    carrierId: row.code,
                    carrierName: row.name,
                    message: publicCarrierRateError(safeErrorMessage(err)),
                });
            }
        }));
        const result = {
            inSelectedArea,
            quotes: (0, shipping_rate_util_1.annotateRateQuotes)(quotes),
            errors,
        };
        this.rateCache.set(cacheKey, { at: Date.now(), value: result });
        if (this.rateCache.size > 80) {
            const first = this.rateCache.keys().next().value;
            if (first)
                this.rateCache.delete(first);
        }
        return result;
    }
    async resolveBabelNeighbourhoodId(input) {
        const existing = input.existingId != null && input.existingId !== ''
            ? Number(input.existingId)
            : null;
        if (existing != null && Number.isFinite(existing) && existing > 0) {
            return existing;
        }
        return this.babelAddress.resolveNeighbourhoodId({
            governorate: input.governorate,
            cityRegion: input.cityRegion,
            townNeighborhood: input.townNeighborhood,
        });
    }
    async assertLiveCarrierSelection(params) {
        if ((params.fields.shippingMethod ?? client_1.ShippingMethod.manual) !== client_1.ShippingMethod.carrier) {
            return;
        }
        const code = params.fields.shippingProviderCode?.trim();
        if (!code) {
            throw new common_1.BadRequestException('shippingProviderCode is required when shippingMethod=carrier.');
        }
        if (!this.registry.has(code)) {
            throw new common_1.BadRequestException(`Shipping provider "${code}" is not registered.`);
        }
        const lat = Number(params.fields.shippingReceiverLat);
        const lng = Number(params.fields.shippingReceiverLng);
        const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
        if (hasCoords) {
            const boundary = await this.geo.lookupBoundary({
                governorate: params.governorate,
                city: params.city,
                neighborhood: params.neighborhood,
            });
            if (boundary && !this.geo.containsPoint(boundary, { lat, lng })) {
                throw new common_1.BadRequestException('Receiver location is outside the selected delivery area. Place the pin inside the highlighted area.');
            }
        }
        const neighbourhoodId = await this.resolveBabelNeighbourhoodId({
            existingId: params.fields.babelNeighbourhoodId,
            governorate: params.governorate,
            cityRegion: params.city,
            townNeighborhood: params.neighborhood,
        });
        const hasBabelHood = neighbourhoodId != null;
        const hasAddressNames = Boolean(params.governorate?.trim() && params.city?.trim() && params.neighborhood?.trim());
        const hasDestination = hasBabelHood || hasCoords || hasAddressNames;
        const weight = Number(params.fields.shippingWeightKg);
        const canQuote = hasDestination &&
            !!params.fields.shippingPackageType &&
            !!params.fields.shippingDeliveryType &&
            Number.isFinite(weight) &&
            weight > 0;
        if (!canQuote) {
            if (params.requireQuote) {
                throw new common_1.BadRequestException('Shipping address (Governorate / City / Town), package type, weight, and delivery type are required to confirm the shipping company.');
            }
            return;
        }
        try {
            const { credentials } = await this.requireConnectedCredentials(code);
            const adapter = this.registry.get(code);
            await adapter.getQuote(credentials, {
                receiverLat: hasCoords ? lat : 0,
                receiverLng: hasCoords ? lng : 0,
                neighbourhoodId: neighbourhoodId ?? undefined,
                packageType: params.fields.shippingPackageType,
                weightKg: params.fields.shippingPackageType === 'envelope' ? 1 : weight,
                deliveryType: params.fields.shippingDeliveryType,
                pickupType: params.fields.shippingPickupType ?? undefined,
                volumeCbm: params.fields.shippingVolumeCbm != null
                    ? Number(params.fields.shippingVolumeCbm)
                    : undefined,
                governorate: params.governorate ?? undefined,
                city: params.city ?? undefined,
                neighborhood: params.neighborhood ?? undefined,
            });
        }
        catch (err) {
            if (err instanceof common_1.BadRequestException)
                throw err;
            throw new common_1.BadRequestException(publicCarrierRateError(safeErrorMessage(err)));
        }
    }
    async listProviders() {
        const rows = await this.prisma.shippingProvider.findMany({
            orderBy: { name: 'asc' },
            include: {
                connection: {
                    include: {
                        connectedBy: { select: { id: true, email: true, fullName: true } },
                    },
                },
            },
        });
        return rows.map((p) => this.toProviderView(p));
    }
    async connectProvider(code, username, password, userId) {
        const provider = await this.requireProvider(code);
        if (!this.registry.has(code)) {
            throw new common_1.BadRequestException(`Provider "${code}" is not supported.`);
        }
        const adapter = this.registry.get(code);
        const test = await adapter.testConnection({ username, password });
        if (!test.ok) {
            throw new common_1.BadRequestException(test.message ?? 'Connection test failed.');
        }
        const encryptedUsername = this.encryption.encrypt(username);
        const encryptedPassword = this.encryption.encrypt(password);
        await this.prisma.shippingProviderConnection.upsert({
            where: { providerId: provider.id },
            create: {
                providerId: provider.id,
                status: client_1.ShippingProviderConnectionStatus.connected,
                encryptedUsername,
                encryptedPassword,
                connectedByUserId: userId,
                lastTestedAt: new Date(),
                lastTestStatus: 'ok',
                lastErrorSafe: null,
            },
            update: {
                status: client_1.ShippingProviderConnectionStatus.connected,
                encryptedUsername,
                encryptedPassword,
                connectedByUserId: userId,
                lastTestedAt: new Date(),
                lastTestStatus: 'ok',
                lastErrorSafe: null,
            },
        });
        return this.getProviderView(code);
    }
    async testProvider(code) {
        const { credentials, provider } = await this.requireConnectedCredentials(code);
        const adapter = this.registry.get(code);
        const result = await adapter.testConnection(credentials);
        await this.prisma.shippingProviderConnection.update({
            where: { providerId: provider.id },
            data: {
                lastTestedAt: new Date(),
                lastTestStatus: result.ok ? 'ok' : 'failed',
                lastErrorSafe: result.ok ? null : (result.message ?? 'Test failed').slice(0, 500),
            },
        });
        return result;
    }
    async disconnectProvider(code) {
        const provider = await this.requireProvider(code);
        await this.prisma.shippingProviderConnection.upsert({
            where: { providerId: provider.id },
            create: {
                providerId: provider.id,
                status: client_1.ShippingProviderConnectionStatus.disconnected,
                encryptedUsername: null,
                encryptedPassword: null,
                connectedByUserId: null,
                lastTestedAt: null,
                lastTestStatus: null,
                lastErrorSafe: null,
            },
            update: {
                status: client_1.ShippingProviderConnectionStatus.disconnected,
                encryptedUsername: null,
                encryptedPassword: null,
                connectedByUserId: null,
                lastTestStatus: null,
                lastErrorSafe: null,
            },
        });
        return this.getProviderView(code);
    }
    async ensureShipmentForOutbound(outboundOrderId) {
        const order = await this.prisma.outboundOrder.findUnique({
            where: { id: outboundOrderId },
            include: {
                lines: {
                    include: {
                        product: {
                            select: {
                                weightKg: true,
                                lengthCm: true,
                                widthCm: true,
                                heightCm: true,
                                name: true,
                            },
                        },
                    },
                },
                omsOrder: {
                    select: {
                        orderNumber: true,
                        id: true,
                        trackingNumber: true,
                        carrier: true,
                        status: true,
                        paymentMethod: true,
                        codAmount: true,
                        currency: true,
                        babelNeighbourhoodId: true,
                        city: true,
                        district: true,
                        addressLine1: true,
                    },
                },
            },
        });
        if (!order) {
            this.logger.warn(`ensureShipmentForOutbound: outbound ${outboundOrderId} not found`);
            return;
        }
        if (order.shippingMethod !== client_1.ShippingMethod.carrier) {
            return;
        }
        const blockedOutbound = new Set([
            'externally_fulfilled',
            'shipped',
            'cancelled',
            'delivered',
            'returned',
        ]);
        if (blockedOutbound.has(order.status)) {
            this.logger.log(`ensureShipmentForOutbound: skip carrier for outbound ${outboundOrderId} status=${order.status}`);
            return;
        }
        const omsStatus = order.omsOrder?.status;
        if (omsStatus &&
            [
                'shipped',
                'out_for_delivery',
                'delivered',
                'returned',
                'cancelled',
                'failed_delivery',
                'completed',
                'rejected',
            ].includes(omsStatus)) {
            this.logger.log(`ensureShipmentForOutbound: skip carrier; OMS ${omsStatus} blocks warehouse handoff for ${outboundOrderId}`);
            return;
        }
        const existingCreated = await this.prisma.carrierShipment.findFirst({
            where: {
                outboundOrderId,
                status: client_1.CarrierShipmentStatus.created,
            },
        });
        if (existingCreated) {
            return;
        }
        const existingAwb = order.trackingNumber?.trim() ||
            order.omsOrder?.trackingNumber?.trim() ||
            null;
        if (existingAwb) {
            await this.persistCreatedFromExistingAwb({
                outboundOrderId,
                companyId: order.companyId,
                status: order.status,
                providerCode: order.shippingProviderCode?.trim() || shipping_provider_registry_1.BABEL_EXPRESS_CODE,
                awb: existingAwb,
                carrierLabel: order.carrier ?? order.omsOrder?.carrier ?? null,
                omsOrderId: order.omsOrder?.id ?? null,
            });
            return;
        }
        const providerCode = order.shippingProviderCode?.trim() || shipping_provider_registry_1.BABEL_EXPRESS_CODE;
        let provider;
        try {
            provider = await this.requireProvider(providerCode);
        }
        catch (err) {
            await this.persistFailedShipment({
                outboundOrderId,
                providerId: null,
                providerCode,
                error: safeErrorMessage(err),
            });
            this.emitOutboundShippingUpdate(order.companyId, outboundOrderId, order.status);
            return;
        }
        const connection = await this.prisma.shippingProviderConnection.findUnique({
            where: { providerId: provider.id },
        });
        if (!connection ||
            connection.status !== client_1.ShippingProviderConnectionStatus.connected ||
            !connection.encryptedUsername ||
            !connection.encryptedPassword) {
            await this.persistFailedShipment({
                outboundOrderId,
                providerId: provider.id,
                providerCode,
                error: `${provider.name} is not connected.`,
            });
            this.emitOutboundShippingUpdate(order.companyId, outboundOrderId, order.status);
            return;
        }
        try {
            const babelNeighbourhoodId = await this.resolveBabelNeighbourhoodId({
                existingId: order.babelNeighbourhoodId ?? order.omsOrder?.babelNeighbourhoodId ?? null,
                governorate: order.city ?? order.omsOrder?.city,
                cityRegion: order.district ?? order.omsOrder?.district,
                townNeighborhood: order.addressLine1 ?? order.omsOrder?.addressLine1,
            });
            (0, shipping_config_util_1.assertCarrierShippingReady)({
                shippingMethod: order.shippingMethod,
                shippingProviderCode: order.shippingProviderCode,
                shippingReceiverLat: order.shippingReceiverLat?.toString() ?? null,
                shippingReceiverLng: order.shippingReceiverLng?.toString() ?? null,
                shippingPackageType: order.shippingPackageType,
                shippingContents: order.shippingContents,
                shippingDeliveryType: order.shippingDeliveryType,
                shippingPickupType: order.shippingPickupType,
                shippingPayer: order.shippingPayer,
                shippingWeightKg: order.shippingWeightKg?.toString() ?? null,
                babelNeighbourhoodId,
            });
        }
        catch (err) {
            await this.persistFailedShipment({
                outboundOrderId,
                providerId: provider.id,
                providerCode,
                error: safeErrorMessage(err),
            });
            this.emitOutboundShippingUpdate(order.companyId, outboundOrderId, order.status);
            return;
        }
        const phone = (0, babel_shipment_mapper_1.parsePhoneForBabel)(order.recipientPhone, order.shippingPhoneCountry);
        if (!phone) {
            const reason = !order.recipientPhone?.trim()
                ? 'Recipient phone number is missing. Add a phone number to the order before sending.'
                : 'Recipient phone could not be parsed into country dial code + local number. Set shippingPhoneCountry.';
            await this.persistFailedShipment({
                outboundOrderId,
                providerId: provider.id,
                providerCode,
                error: reason,
            });
            this.emitOutboundShippingUpdate(order.companyId, outboundOrderId, order.status);
            return;
        }
        const weightKg = Number(order.shippingWeightKg);
        if (!Number.isFinite(weightKg) || weightKg <= 0) {
            await this.persistFailedShipment({
                outboundOrderId,
                providerId: provider.id,
                providerCode,
                error: 'Shipment weight is missing or invalid.',
            });
            this.emitOutboundShippingUpdate(order.companyId, outboundOrderId, order.status);
            return;
        }
        const address = (0, oms_order_mapper_1.composeDestinationAddress)({
            destinationAddress: order.destinationAddress,
            addressLine1: order.addressLine1 ?? undefined,
            addressLine2: order.addressLine2 ?? undefined,
            district: order.district ?? undefined,
            city: order.city ?? undefined,
        }) ||
            order.destinationAddress ||
            '';
        if (!order.recipientName?.trim() || !address.trim()) {
            await this.persistFailedShipment({
                outboundOrderId,
                providerId: provider.id,
                providerCode,
                error: 'Recipient name and address are required for carrier shipping.',
            });
            this.emitOutboundShippingUpdate(order.companyId, outboundOrderId, order.status);
            return;
        }
        let username;
        let password;
        try {
            username = this.encryption.decrypt(connection.encryptedUsername);
            password = this.encryption.decrypt(connection.encryptedPassword);
        }
        catch (err) {
            await this.persistFailedShipment({
                outboundOrderId,
                providerId: provider.id,
                providerCode,
                error: 'Failed to decrypt provider credentials.',
            });
            this.emitOutboundShippingUpdate(order.companyId, outboundOrderId, order.status);
            return;
        }
        const claimId = await this.claimPendingShipment({
            outboundOrderId,
            providerId: provider.id,
            providerCode,
        });
        if (!claimId) {
            return;
        }
        const oms = order.omsOrder;
        const paymentMethod = order.paymentMethod ?? oms?.paymentMethod ?? null;
        const rawCodAmount = order.codAmount ?? oms?.codAmount ?? null;
        const orderCurrency = order.currency ?? oms?.currency ?? null;
        const isCod = paymentMethod === 'COD';
        const codAmount = isCod && rawCodAmount != null ? Number(rawCodAmount) : 0;
        const codCurrency = (0, babel_shipment_mapper_1.resolveBabelCodCurrency)(orderCurrency);
        if (isCod && (!Number.isFinite(codAmount) || codAmount <= 0)) {
            await this.failClaim(claimId, outboundOrderId, order.companyId, order.status, 'COD order is missing a collectible amount. Set COD on the OMS order before Send Shipment.');
            return;
        }
        if (isCod && codCurrency === 'SYP' && codAmount < 1000) {
            await this.failClaim(claimId, outboundOrderId, order.companyId, order.status, `COD amount ${codAmount} SYP is below Babel Express minimum (1,000 SYP).`);
            return;
        }
        const adapter = this.registry.get(providerCode);
        const reference = order.omsOrder?.orderNumber ?? order.orderNumber ?? order.clientReference ?? undefined;
        const babelNeighbourhoodId = order.babelNeighbourhoodId ??
            order.omsOrder?.babelNeighbourhoodId ??
            (await this.resolveBabelNeighbourhoodId({
                governorate: order.city ?? order.omsOrder?.city,
                cityRegion: order.district ?? order.omsOrder?.district,
                townNeighborhood: order.addressLine1 ?? order.omsOrder?.addressLine1,
            }));
        const physicalParts = (0, shipment_parts_util_1.buildPhysicalShipmentParts)((order.lines ?? []).map((line) => ({
            productId: line.productId,
            productName: line.product?.name ?? 'item',
            quantity: Number(line.requestedQuantity),
            weightKg: line.product?.weightKg != null ? Number(line.product.weightKg) : null,
            lengthCm: line.product?.lengthCm != null ? Number(line.product.lengthCm) : null,
            widthCm: line.product?.widthCm != null ? Number(line.product.widthCm) : null,
            heightCm: line.product?.heightCm != null ? Number(line.product.heightCm) : null,
        })));
        const babelParts = (0, shipment_parts_util_1.toBabelWeightParts)(physicalParts, order.shippingPackageType === 'envelope' ? 'envelope' : 'box');
        this.logger.log(JSON.stringify({
            msg: 'babel_create_shipment_attempt',
            outboundOrderId,
            babelNeighbourhoodId,
            deliveryType: order.shippingDeliveryType,
            pickupType: order.shippingPickupType,
            packageType: order.shippingPackageType,
            partCount: babelParts.length,
            totalWeightKg: weightKg,
            payer: order.shippingPayer,
            isCod,
            codAmount: isCod ? codAmount : 0,
            codCurrency,
        }));
        try {
            const result = await adapter.createShipment({ username, password }, {
                reference,
                receiver: {
                    name: order.recipientName.trim(),
                    phoneCountry: phone.country,
                    phoneLocal: phone.phone,
                    address: address.trim(),
                    lat: Number(order.shippingReceiverLat) || 0,
                    lng: Number(order.shippingReceiverLng) || 0,
                    neighbourhoodId: babelNeighbourhoodId != null ? Number(babelNeighbourhoodId) : undefined,
                },
                packageType: order.shippingPackageType,
                weightKg: order.shippingPackageType === 'envelope' ? 1 : weightKg,
                parts: babelParts,
                contents: order.shippingContents.trim(),
                deliveryType: order.shippingDeliveryType,
                pickupType: order.shippingPickupType,
                payer: order.shippingPayer,
                codAmount: isCod && Number.isFinite(codAmount) ? codAmount : 0,
                currency: codCurrency,
            });
            await this.prisma.$transaction(async (tx) => {
                const again = await tx.carrierShipment.findFirst({
                    where: { outboundOrderId, status: client_1.CarrierShipmentStatus.created },
                });
                if (again) {
                    await tx.carrierShipment.update({
                        where: { id: claimId },
                        data: {
                            status: client_1.CarrierShipmentStatus.failed,
                            lastErrorSafe: 'Superseded by existing created shipment',
                        },
                    });
                    return;
                }
                await tx.carrierShipment.update({
                    where: { id: claimId },
                    data: {
                        externalAwb: result.awb,
                        trackingNumber: result.awb,
                        status: client_1.CarrierShipmentStatus.created,
                        lastErrorSafe: null,
                        rawResultMeta: (result.raw ?? { awb: result.awb }),
                    },
                });
                await tx.outboundOrder.update({
                    where: { id: outboundOrderId },
                    data: {
                        carrier: provider.name,
                        trackingNumber: result.awb,
                    },
                });
                if (order.omsOrder?.id) {
                    await tx.omsOrder.update({
                        where: { id: order.omsOrder.id },
                        data: {
                            carrier: provider.name,
                            trackingNumber: result.awb,
                        },
                    });
                }
            });
            this.emitOutboundShippingUpdate(order.companyId, outboundOrderId, order.status);
        }
        catch (err) {
            this.logger.warn(`Carrier createShipment failed for outbound ${outboundOrderId}: ${safeErrorMessage(err)}`);
            await this.prisma.carrierShipment.update({
                where: { id: claimId },
                data: {
                    status: client_1.CarrierShipmentStatus.failed,
                    lastErrorSafe: safeErrorMessage(err),
                },
            });
            this.emitOutboundShippingUpdate(order.companyId, outboundOrderId, order.status);
        }
    }
    async failClaim(claimId, outboundOrderId, companyId, orderStatus, message) {
        await this.prisma.carrierShipment.update({
            where: { id: claimId },
            data: {
                status: client_1.CarrierShipmentStatus.failed,
                lastErrorSafe: message,
            },
        });
        this.emitOutboundShippingUpdate(companyId, outboundOrderId, orderStatus);
    }
    async claimPendingShipment(params) {
        try {
            const row = await this.prisma.carrierShipment.create({
                data: {
                    outboundOrderId: params.outboundOrderId,
                    providerId: params.providerId,
                    providerCode: params.providerCode,
                    status: client_1.CarrierShipmentStatus.pending,
                },
                select: { id: true },
            });
            return row.id;
        }
        catch (err) {
            if (err instanceof client_1.Prisma.PrismaClientKnownRequestError &&
                err.code === 'P2002') {
                this.logger.log(`claimPendingShipment: in-flight or created shipment already exists for outbound ${params.outboundOrderId}`);
                return null;
            }
            throw err;
        }
    }
    async persistCreatedFromExistingAwb(params) {
        let providerId = null;
        try {
            const provider = await this.requireProvider(params.providerCode);
            providerId = provider.id;
        }
        catch {
            this.logger.warn(`persistCreatedFromExistingAwb: provider ${params.providerCode} missing; skip row for ${params.outboundOrderId}`);
            return;
        }
        try {
            await this.prisma.$transaction(async (tx) => {
                const again = await tx.carrierShipment.findFirst({
                    where: {
                        outboundOrderId: params.outboundOrderId,
                        status: client_1.CarrierShipmentStatus.created,
                    },
                });
                if (again)
                    return;
                await tx.carrierShipment.create({
                    data: {
                        outboundOrderId: params.outboundOrderId,
                        providerId: providerId,
                        providerCode: params.providerCode,
                        externalAwb: params.awb,
                        trackingNumber: params.awb,
                        status: client_1.CarrierShipmentStatus.created,
                        lastErrorSafe: null,
                        rawResultMeta: { reusedExistingAwb: true, awb: params.awb },
                    },
                });
                if (params.carrierLabel) {
                    await tx.outboundOrder.update({
                        where: { id: params.outboundOrderId },
                        data: {
                            carrier: params.carrierLabel,
                            trackingNumber: params.awb,
                        },
                    });
                    if (params.omsOrderId) {
                        await tx.omsOrder.update({
                            where: { id: params.omsOrderId },
                            data: {
                                carrier: params.carrierLabel,
                                trackingNumber: params.awb,
                            },
                        });
                    }
                }
            });
        }
        catch (err) {
            if (err instanceof client_1.Prisma.PrismaClientKnownRequestError &&
                err.code === 'P2002') {
                return;
            }
            throw err;
        }
        this.emitOutboundShippingUpdate(params.companyId, params.outboundOrderId, params.status);
    }
    async retryShipment(outboundOrderId) {
        const created = await this.prisma.carrierShipment.findFirst({
            where: { outboundOrderId, status: client_1.CarrierShipmentStatus.created },
        });
        if (created) {
            throw new common_1.BadRequestException('A successful carrier shipment already exists for this outbound order.');
        }
        const order = await this.prisma.outboundOrder.findUnique({
            where: { id: outboundOrderId },
            select: { id: true, shippingMethod: true, status: true },
        });
        if (!order)
            throw new common_1.NotFoundException('Outbound order not found.');
        if (order.shippingMethod !== client_1.ShippingMethod.carrier) {
            throw new common_1.BadRequestException('Outbound order is not configured for carrier shipping.');
        }
        if (order.status !== 'waiting_for_shipping_details' && order.status !== 'ready_to_ship' && order.status !== 'shipped') {
            throw new common_1.BadRequestException('Retry is only available during Waiting for Shipping Details or after ready_to_ship.');
        }
        await this.prisma.carrierShipment.updateMany({
            where: { outboundOrderId, status: client_1.CarrierShipmentStatus.pending },
            data: {
                status: client_1.CarrierShipmentStatus.failed,
                lastErrorSafe: 'Pending claim released for retry',
            },
        });
        await this.ensureShipmentForOutbound(outboundOrderId);
        return { ok: true };
    }
    async getLatestShipment(outboundOrderId) {
        return this.prisma.carrierShipment.findFirst({
            where: { outboundOrderId },
            orderBy: { createdAt: 'desc' },
        });
    }
    async getDecryptedCredentials(code) {
        const { credentials } = await this.requireConnectedCredentials(code);
        return credentials;
    }
    async getProviderView(code) {
        const provider = await this.prisma.shippingProvider.findUnique({
            where: { code },
            include: {
                connection: {
                    include: {
                        connectedBy: { select: { id: true, email: true, fullName: true } },
                    },
                },
            },
        });
        if (!provider)
            throw new common_1.NotFoundException(`Shipping provider "${code}" not found.`);
        return this.toProviderView(provider);
    }
    toProviderView(provider) {
        const conn = provider.connection;
        let usernameMasked = null;
        if (conn?.encryptedUsername) {
            try {
                usernameMasked = maskUsername(this.encryption.decrypt(conn.encryptedUsername));
            }
            catch {
                usernameMasked = '********';
            }
        }
        const connected = conn?.status === client_1.ShippingProviderConnectionStatus.connected;
        return {
            code: provider.code,
            name: provider.name,
            enabled: provider.enabled,
            status: connected ? 'connected' : 'disconnected',
            connected,
            usernameMasked,
            connectedBy: conn?.connectedBy
                ? {
                    id: conn.connectedBy.id,
                    email: conn.connectedBy.email,
                    fullName: conn.connectedBy.fullName,
                }
                : null,
            lastTestedAt: conn?.lastTestedAt?.toISOString() ?? null,
            lastTestStatus: conn?.lastTestStatus ?? null,
            lastErrorSafe: conn?.lastErrorSafe ?? null,
        };
    }
    async requireProvider(code) {
        const provider = await this.prisma.shippingProvider.findUnique({ where: { code } });
        if (!provider || !provider.enabled) {
            throw new common_1.NotFoundException(`Shipping provider "${code}" not found.`);
        }
        return provider;
    }
    async requireConnectedCredentials(code) {
        const provider = await this.requireProvider(code);
        const connection = await this.prisma.shippingProviderConnection.findUnique({
            where: { providerId: provider.id },
        });
        if (!connection ||
            connection.status !== client_1.ShippingProviderConnectionStatus.connected ||
            !connection.encryptedUsername ||
            !connection.encryptedPassword) {
            throw new common_1.BadRequestException(`${provider.name} is not connected.`);
        }
        return {
            provider,
            credentials: {
                username: this.encryption.decrypt(connection.encryptedUsername),
                password: this.encryption.decrypt(connection.encryptedPassword),
            },
        };
    }
    async persistFailedShipment(params) {
        if (!params.providerId) {
            this.logger.warn(`carrier_shipments skip (no providerId) outbound=${params.outboundOrderId}: ${params.error}`);
            return;
        }
        await this.prisma.carrierShipment.create({
            data: {
                outboundOrderId: params.outboundOrderId,
                providerId: params.providerId,
                providerCode: params.providerCode,
                status: client_1.CarrierShipmentStatus.failed,
                lastErrorSafe: params.error.slice(0, 500),
            },
        });
    }
    emitOutboundShippingUpdate(companyId, orderId, status) {
        try {
            this.realtime.emitOutboundOrderUpdated(companyId, {
                orderId,
                status,
                reason: 'shipping.shipment.updated',
            });
        }
        catch (err) {
            this.logger.warn(`realtime emit failed: ${safeErrorMessage(err)}`);
        }
    }
};
exports.ShippingService = ShippingService;
exports.ShippingService = ShippingService = ShippingService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        encryption_service_1.EncryptionService,
        shipping_provider_registry_1.ShippingProviderRegistry,
        realtime_service_1.RealtimeService,
        shipping_geo_service_1.ShippingGeoService,
        babel_address_adapter_1.BabelAddressAdapter])
], ShippingService);
//# sourceMappingURL=shipping.service.js.map