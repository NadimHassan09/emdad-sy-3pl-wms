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
const carrier_constraints_1 = require("./carrier-constraints");
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const encryption_service_1 = require("../../common/crypto/encryption.service");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const realtime_service_1 = require("../realtime/realtime.service");
const oms_order_mapper_1 = require("../oms/oms-order.mapper");
const babel_address_adapter_1 = require("./providers/babel-express/babel-address.adapter");
const address_resolve_service_1 = require("./address-resolve.service");
const carrier_currency_1 = require("./carrier-currency");
const cod_collection_1 = require("./cod-collection");
const shipping_fx_service_1 = require("./shipping-fx.service");
const babel_express_http_client_1 = require("./providers/babel-express/babel-express.http-client");
const babel_shipment_mapper_1 = require("./providers/babel-express/babel-shipment.mapper");
const shipping_provider_registry_1 = require("./shipping-provider.registry");
const shipping_carrier_resolver_1 = require("./shipping-carrier-resolver");
const sila_meta_util_1 = require("./providers/sila-sy/sila-meta.util");
const shipping_config_util_1 = require("./shipping-config.util");
const shipping_error_1 = require("./shipping-error");
const shipping_preflight_1 = require("./shipping-preflight");
const shipping_geo_service_1 = require("./shipping-geo.service");
const provider_cod_1 = require("./provider-cod");
const shipping_rate_util_1 = require("./shipping-rate.util");
const shipment_parts_util_1 = require("./shipment-parts.util");
const shipping_cartons_types_1 = require("./shipping-cartons.types");
const quote_freshness_1 = require("./quote-freshness");
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
    if (/no neighbourhood id and no coordinates/i.test(msg)) {
        return 'The address needs a neighbourhood so this carrier can price it. Complete the neighbourhood and try again.';
    }
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
function confirmedServiceIdForProvider(providerCode, order) {
    const matching = [order.shippingServiceId, order.omsOrder?.shippingServiceId].find((value) => (0, shipping_carrier_resolver_1.serviceIdBelongsToProvider)(value, providerCode));
    if (matching)
        return matching || null;
    if (providerCode === shipping_provider_registry_1.BABEL_EXPRESS_CODE)
        return `${shipping_provider_registry_1.BABEL_EXPRESS_CODE}:address`;
    return null;
}
function confirmedCarrierDisplayName(params) {
    return ((0, shipping_carrier_resolver_1.resolveShippingCarrierName)({
        carrier: null,
        shippingProviderCode: params.providerCode,
        shippingServiceId: params.serviceId,
        outboundOrder: {
            carrier: null,
            shippingProviderCode: params.providerCode,
            shippingServiceId: params.serviceId,
            carrierShipments: [
                {
                    status: 'created',
                    supersededAt: null,
                    providerCode: params.providerCode,
                    rawResultMeta: params.raw,
                },
            ],
        },
    }) || (params.providerCode === shipping_provider_registry_1.BABEL_EXPRESS_CODE ? 'Babel Express' : params.providerName));
}
function leftoverAwbCompatibleWithProvider(providerCode, leftoverCarrier) {
    const leftover = leftoverCarrier?.trim() || '';
    if (!leftover)
        return true;
    const selectedDisplay = (0, shipping_carrier_resolver_1.displayNameForProviderCode)(providerCode);
    if (selectedDisplay) {
        return (0, shipping_carrier_resolver_1.normalizeCourierDisplayName)(leftover) === selectedDisplay;
    }
    if (providerCode === shipping_provider_registry_1.SILA_SY_CODE) {
        return !leftover.toLowerCase().includes('babel');
    }
    return true;
}
function confirmedCarrierIdentityPatch(params) {
    const carrier = confirmedCarrierDisplayName(params);
    return {
        carrier,
        trackingNumber: params.trackingNumber?.trim() || null,
        shippingProviderCode: params.providerCode,
        shippingServiceId: params.serviceId,
    };
}
let ShippingService = class ShippingService {
    static { ShippingService_1 = this; }
    prisma;
    encryption;
    registry;
    realtime;
    geo;
    babelAddress;
    addressResolve;
    fx;
    logger = new common_1.Logger(ShippingService_1.name);
    constructor(prisma, encryption, registry, realtime, geo, babelAddress, addressResolve, fx) {
        this.prisma = prisma;
        this.encryption = encryption;
        this.registry = registry;
        this.realtime = realtime;
        this.geo = geo;
        this.babelAddress = babelAddress;
        this.addressResolve = addressResolve;
        this.fx = fx;
    }
    async onModuleInit() {
        await this.ensureSeedProviders();
    }
    async ensureSeedProviders() {
        const seed = [
            { code: shipping_provider_registry_1.BABEL_EXPRESS_CODE, name: 'Babel Express' },
            { code: shipping_provider_registry_1.SILA_SY_CODE, name: 'Sila-SY.com' },
            { code: shipping_provider_registry_1.SENA_EXPRESS_CODE, name: 'شركة سينا (SENA Express)' },
        ];
        for (const p of seed) {
            await this.prisma.shippingProvider.upsert({
                where: { code: p.code },
                create: { code: p.code, name: p.name, enabled: true },
                update: { name: p.name },
            });
        }
    }
    static ORIGIN_ADDRESS_ID = 'default';
    async getOriginAddress() {
        const row = await this.prisma.shippingOriginAddress.findUnique({
            where: { id: ShippingService_1.ORIGIN_ADDRESS_ID },
        });
        if (!row)
            return null;
        return {
            contactName: row.contactName,
            phone: row.phone,
            city: row.city,
            district: row.district,
            street: row.street,
            lat: row.lat != null ? Number(row.lat) : null,
            lng: row.lng != null ? Number(row.lng) : null,
            updatedAt: row.updatedAt.toISOString(),
        };
    }
    async saveOriginAddress(input, userId) {
        const lat = Number.isFinite(input.lat) ? input.lat : null;
        const lng = Number.isFinite(input.lng) ? input.lng : null;
        await this.prisma.shippingOriginAddress.upsert({
            where: { id: ShippingService_1.ORIGIN_ADDRESS_ID },
            create: {
                id: ShippingService_1.ORIGIN_ADDRESS_ID,
                contactName: input.contactName.trim(),
                phone: input.phone.trim(),
                city: input.city.trim(),
                district: input.district?.trim() || null,
                street: input.street.trim(),
                lat,
                lng,
                updatedByUserId: userId,
            },
            update: {
                contactName: input.contactName.trim(),
                phone: input.phone.trim(),
                city: input.city.trim(),
                district: input.district?.trim() || null,
                street: input.street.trim(),
                lat,
                lng,
                updatedByUserId: userId,
            },
        });
        return this.getOriginAddress();
    }
    async saveCodCollection(outboundOrderId, collectionCurrency) {
        const order = await this.prisma.outboundOrder.findUnique({
            where: { id: outboundOrderId },
            include: {
                omsOrder: { select: { id: true, codAmount: true, currency: true } },
            },
        });
        if (!order)
            throw new common_1.NotFoundException('Outbound order not found');
        const originalAmount = Number(order.omsOrder?.codAmount ?? order.codAmount ?? 0);
        const originalCurrency = order.omsOrder?.currency?.trim() || order.currency || 'USD';
        const rate = await this.fx.usableRate();
        const converted = (0, cod_collection_1.convertCodCollection)({
            orderAmount: originalAmount,
            orderCurrency: originalCurrency,
            collectionCurrency,
            usdToSypRate: rate?.rate ?? null,
            rateSource: rate?.source ?? null,
            rateAt: rate?.at ?? null,
        });
        if ('error' in converted) {
            throw new common_1.BadRequestException({
                message: converted.error === 'missing_rate'
                    ? 'No USD/SYP exchange rate is available. Set one on Shipping Companies before converting COD.'
                    : 'COD amount is not a valid number.',
                code: 'SHIPMENT_CURRENCY',
                fields: { currency: 'missing_rate' },
            });
        }
        const data = {
            codCollectionCurrency: converted.currency,
            codCollectionAmount: new client_1.Prisma.Decimal(converted.amount),
            codFxRate: converted.rate != null ? new client_1.Prisma.Decimal(converted.rate) : null,
            codFxSource: converted.source,
            codFxAt: converted.rateAt ? new Date(converted.rateAt) : null,
        };
        await this.prisma.outboundOrder.update({ where: { id: order.id }, data });
        if (order.omsOrder?.id) {
            await this.prisma.omsOrder.update({ where: { id: order.omsOrder.id }, data });
        }
        return {
            originalAmount,
            originalCurrency,
            ...converted,
        };
    }
    async clearCodCollection(outboundOrderId) {
        const order = await this.prisma.outboundOrder.findUnique({
            where: { id: outboundOrderId },
            select: { id: true, omsOrder: { select: { id: true } } },
        });
        if (!order)
            throw new common_1.NotFoundException('Outbound order not found');
        const data = {
            codCollectionCurrency: null,
            codCollectionAmount: null,
            codFxRate: null,
            codFxSource: null,
            codFxAt: null,
        };
        await this.prisma.outboundOrder.update({ where: { id: order.id }, data });
        if (order.omsOrder?.id) {
            await this.prisma.omsOrder.update({ where: { id: order.omsOrder.id }, data });
        }
    }
    async getConfiguredPickupParty() {
        const row = await this.prisma.shippingOriginAddress.findUnique({
            where: { id: ShippingService_1.ORIGIN_ADDRESS_ID },
        });
        if (!row)
            return undefined;
        const phone = (0, babel_shipment_mapper_1.parsePhoneForBabel)(row.phone);
        const street = row.street.trim();
        const city = row.city.trim();
        const district = row.district?.trim() || '';
        if (!row.contactName.trim() || !street || !city || !phone)
            return undefined;
        let lat = row.lat != null ? Number(row.lat) : undefined;
        let lng = row.lng != null ? Number(row.lng) : undefined;
        const cityRegion = district || city;
        const townNeighborhood = district || street;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            const resolved = this.resolveReceiverCoordinatesFromAddress({
                governorate: city,
                cityRegion,
                townNeighborhood,
            });
            if (resolved) {
                lat = resolved.lat;
                lng = resolved.lng;
            }
        }
        const neighbourhoodId = await this.babelAddress.resolveNeighbourhoodId({
            governorate: city,
            cityRegion,
            townNeighborhood,
        });
        return {
            name: row.contactName.trim(),
            phoneCountry: phone.country,
            phoneLocal: phone.phone,
            address: [street, district, city].filter(Boolean).join('، '),
            governorate: city,
            city,
            neighborhood: district || street,
            ...(Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : {}),
            ...(neighbourhoodId != null ? { neighbourhoodId } : {}),
        };
    }
    rateCache = new Map();
    rateInflight = new Map();
    providersQuoteCache = null;
    async lookupAreaBoundary(params) {
        return this.geo.lookupBoundary(params);
    }
    resolveReceiverCoordinatesFromAddress(input) {
        const result = this.addressResolve.resolveFromAddress(input);
        if (!result.found)
            return null;
        return { lat: result.lat, lng: result.lng };
    }
    async quoteDestinationRates(dto) {
        const includeAll = dto.includeAllDeliveryTypes === true;
        const cacheKey = JSON.stringify({
            lat: dto.receiverLat != null ? roundCoord(dto.receiverLat) : null,
            lng: dto.receiverLng != null ? roundCoord(dto.receiverLng) : null,
            neighbourhoodId: dto.neighbourhoodId ?? null,
            packageType: dto.packageType,
            weightKg: dto.weightKg,
            deliveryType: includeAll ? 'all' : dto.deliveryType,
            pickupType: dto.pickupType ?? null,
            volumeCbm: dto.volumeCbm ?? null,
            codAmount: dto.codAmount ?? null,
            parts: dto.parts?.map((p) => Number(p.weight)) ?? null,
            hubId: dto.hubId?.trim() || '',
            gov: dto.governorate?.trim() || '',
            city: dto.city?.trim() || '',
            hood: dto.neighborhood?.trim() || '',
            currency: dto.currency?.trim() || '',
            rateCurrency: dto.rateCurrency?.trim() || '',
            collectionMode: dto.collectionMode ?? 'explicit',
            payer: dto.payer ?? '',
            providerCode: dto.providerCode?.trim().toUpperCase() || '',
        });
        const cached = this.rateCache.get(cacheKey);
        if (cached && Date.now() - cached.at < 60_000) {
            return cached.value;
        }
        const inflight = this.rateInflight.get(cacheKey);
        if (inflight)
            return inflight;
        const pending = this.quoteDestinationRatesUncached(dto, includeAll)
            .then((value) => {
            this.rateCache.set(cacheKey, { at: Date.now(), value });
            if (this.rateCache.size > 120) {
                const first = this.rateCache.keys().next().value;
                if (first)
                    this.rateCache.delete(first);
            }
            return value;
        })
            .finally(() => {
            this.rateInflight.delete(cacheKey);
        });
        this.rateInflight.set(cacheKey, pending);
        return pending;
    }
    async listEnabledProvidersForQuote() {
        const now = Date.now();
        if (this.providersQuoteCache && now - this.providersQuoteCache.at < 30_000) {
            return this.providersQuoteCache.rows;
        }
        const rows = await this.prisma.shippingProvider.findMany({
            where: { enabled: true },
            include: { connection: true },
            orderBy: { name: 'asc' },
        });
        this.providersQuoteCache = { at: now, rows };
        return rows;
    }
    async quoteDestinationRatesUncached(dto, includeAll) {
        const hasAddressNames = Boolean(dto.governorate?.trim() && dto.city?.trim());
        let receiverLat = null;
        let receiverLng = null;
        if (hasAddressNames) {
            const resolved = this.resolveReceiverCoordinatesFromAddress({
                governorate: dto.governorate,
                cityRegion: dto.city,
                townNeighborhood: dto.neighborhood,
            });
            if (resolved) {
                receiverLat = resolved.lat;
                receiverLng = resolved.lng;
            }
        }
        if (receiverLat == null &&
            dto.receiverLat != null &&
            dto.receiverLng != null &&
            Number.isFinite(dto.receiverLat) &&
            Number.isFinite(dto.receiverLng)) {
            receiverLat = dto.receiverLat;
            receiverLng = dto.receiverLng;
        }
        const hasCoords = receiverLat != null &&
            receiverLng != null &&
            Number.isFinite(receiverLat) &&
            Number.isFinite(receiverLng);
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
        const providerFilter = dto.providerCode?.trim().toUpperCase() || '';
        const providers = (await this.listEnabledProvidersForQuote()).filter((row) => providerFilter ? row.code.toUpperCase() === providerFilter : true);
        const quotes = [];
        const errors = [];
        const pickup = (dto.pickupType ?? 'address') === 'hub' ? undefined : await this.getConfiguredPickupParty();
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
                const baseInput = {
                    receiverLat: hasCoords ? receiverLat : 0,
                    receiverLng: hasCoords ? receiverLng : 0,
                    neighbourhoodId: neighbourhoodId ?? undefined,
                    packageType: dto.packageType,
                    weightKg: dto.packageType === 'envelope' ? 1 : dto.weightKg,
                    deliveryType: dto.deliveryType,
                    pickupType: dto.pickupType ?? 'address',
                    pickup,
                    volumeCbm: dto.volumeCbm ?? undefined,
                    governorate: dto.governorate,
                    city: dto.city,
                    neighborhood: dto.neighborhood,
                    codAmount: dto.codAmount ?? undefined,
                    currency: dto.rateCurrency ?? undefined,
                    ...(dto.hubId?.trim() ? { hubId: dto.hubId.trim() } : {}),
                    ...(dto.parts && dto.parts.length > 0
                        ? {
                            parts: dto.parts.map((p) => ({
                                weight: Math.max(0.1, Number(p.weight) || 0.1),
                            })),
                        }
                        : {}),
                };
                const rawResults = includeAll
                    ? await this.collectProviderOptionsAllDeliveryTypes(adapter, credentials, baseInput)
                    : adapter.getServiceOptions
                        ? await adapter.getServiceOptions(credentials, baseInput)
                        : [await adapter.getQuote(credentials, baseInput)];
                if (rawResults.length === 0) {
                    errors.push({
                        carrierId: row.code,
                        carrierName: row.name,
                        message: 'Provider quote returned no eligible service.',
                    });
                    return;
                }
                for (const res of rawResults) {
                    if (res.shippable === false)
                        continue;
                    const quotedDeliveryType = res.effectiveDeliveryType ?? dto.deliveryType;
                    const constraintReason = (0, carrier_constraints_1.carrierConstraintViolation)({
                        serviceName: res.serviceName,
                        carrierName: res.providerName ?? row.name,
                        weightKg: dto.weightKg,
                        maxPartWeightKg: dto.parts?.length
                            ? Math.max(...dto.parts.map((p) => Number(p.weight) || 0))
                            : null,
                        codAmount: dto.codAmount,
                        codCurrency: dto.currency,
                        collectionMode: dto.collectionMode ?? 'explicit',
                    });
                    quotes.push({
                        carrierId: row.code,
                        carrierName: row.name,
                        serviceId: res.serviceId ?? `${row.code}:${quotedDeliveryType}`,
                        serviceName: res.serviceName ?? deliveryTypeLabel(quotedDeliveryType),
                        available: constraintReason == null,
                        ...(constraintReason ? { unavailableReason: constraintReason } : {}),
                        price: res.price,
                        currency: (0, carrier_currency_1.carrierPriceCurrency)(row.code, res.currency),
                        sypUnit: (0, carrier_currency_1.carrierSypUnit)(row.code),
                        prices: (res.prices && res.prices.length > 0
                            ? res.prices
                            : [{ price: res.price, currency: res.currency || 'USD' }]).map((p) => ({ ...p, currency: (0, carrier_currency_1.carrierPriceCurrency)(row.code, p.currency) })),
                        estimatedDeliveryMin: res.estimatedDeliveryMin,
                        estimatedDeliveryMax: res.estimatedDeliveryMax,
                        deliveryType: quotedDeliveryType,
                        restrictions: res.restrictions,
                        providerName: res.providerName ?? row.name,
                        logoUrl: res.logoUrl,
                        ...(res.hubs && res.hubs.length > 0
                            ? {
                                hubs: res.hubs,
                                nearestHubId: res.nearestHubId ?? null,
                                nearestHubDetermined: Boolean(res.nearestHubDetermined),
                            }
                            : {}),
                    });
                }
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
        return {
            inSelectedArea: hasCoords ? true : null,
            quotes: (0, shipping_rate_util_1.annotateRateQuotes)(quotes),
            errors,
        };
    }
    async collectProviderOptionsAllDeliveryTypes(adapter, credentials, baseInput) {
        const quoteKey = (r) => `${r.serviceId ?? ''}::${r.effectiveDeliveryType ?? 'address'}::${r.price}::${r.currency}`;
        if (adapter.getServiceOptions) {
            const primary = await adapter.getServiceOptions(credentials, {
                ...baseInput,
                deliveryType: 'address',
            });
            const types = new Set(primary.map((r) => r.effectiveDeliveryType ?? 'address'));
            if (types.has('hub')) {
                return primary;
            }
            const hubOpts = await adapter.getServiceOptions(credentials, {
                ...baseInput,
                deliveryType: 'hub',
            });
            const merged = [...primary];
            const seen = new Set(primary.map(quoteKey));
            for (const r of hubOpts) {
                const k = quoteKey(r);
                if (!seen.has(k)) {
                    seen.add(k);
                    merged.push(r);
                }
            }
            return merged;
        }
        const [addressQuote, hubQuote] = await Promise.all([
            adapter.getQuote(credentials, { ...baseInput, deliveryType: 'address' }).catch(() => null),
            adapter.getQuote(credentials, { ...baseInput, deliveryType: 'hub' }).catch(() => null),
        ]);
        return [addressQuote, hubQuote].filter((q) => q != null);
    }
    async resolveBabelNeighbourhoodId(input) {
        const existing = input.existingId != null && input.existingId !== ''
            ? Number(input.existingId)
            : null;
        if (existing != null && Number.isFinite(existing) && existing > 0) {
            const valid = await this.babelAddress.validateNeighbourhoodId(existing, {
                governorate: input.governorate,
                cityRegion: input.cityRegion,
                townNeighborhood: input.townNeighborhood,
            });
            if (!valid) {
                throw new common_1.BadRequestException(`Babel neighbourhood ID ${existing} is invalid or does not match the delivery governorate/city.`);
            }
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
        let lat = Number(params.fields.shippingReceiverLat);
        let lng = Number(params.fields.shippingReceiverLng);
        const addressCoords = this.resolveReceiverCoordinatesFromAddress({
            governorate: params.governorate,
            cityRegion: params.city,
            townNeighborhood: params.neighborhood,
        });
        if (addressCoords) {
            lat = addressCoords.lat;
            lng = addressCoords.lng;
        }
        const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
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
        const destinationKey = (0, quote_freshness_1.buildDestinationKey)({
            neighbourhoodId,
            governorate: params.governorate,
            city: params.city,
            neighborhood: params.neighborhood,
            lat: hasCoords ? lat : null,
            lng: hasCoords ? lng : null,
        });
        const serviceId = params.shippingServiceId?.trim() ||
            params.quoteFingerprint?.serviceId?.trim() ||
            '';
        const amount = params.quotedAmount != null
            ? Number(params.quotedAmount)
            : params.quoteFingerprint?.amount != null
                ? Number(params.quoteFingerprint.amount)
                : NaN;
        const currency = params.quotedCurrency?.trim() ||
            params.quoteFingerprint?.currency?.trim() ||
            'USD';
        const hubId = (params.fields.shippingHubId || '').trim();
        if (String(params.fields.shippingDeliveryType) === 'hub' &&
            params.quoteFingerprint &&
            (params.quoteFingerprint.hubId || '').trim() !== hubId) {
            throw new common_1.BadRequestException('Quote is stale after hub selection changed. Refresh the quote and confirm the new rate before sending.');
        }
        if (params.quoteFingerprint &&
            serviceId &&
            Number.isFinite(amount) &&
            (0, quote_freshness_1.isQuoteFingerprintFresh)(params.quoteFingerprint, {
                providerCode: code,
                serviceId,
                currency,
                amount,
                deliveryType: String(params.fields.shippingDeliveryType),
                packageType: String(params.fields.shippingPackageType),
                weightKg: params.fields.shippingPackageType === 'envelope' ? 1 : weight,
                destinationKey,
                partsKey: params.partsKey ?? params.quoteFingerprint.partsKey ?? '',
                hubId,
            })) {
            this.logger.debug(`Skipping live re-quote for ${code} — fresh fingerprint matches destination/service.`);
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
                ...(hubId ? { hubId } : {}),
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
    async connectProvider(code, username, password, userId, webhookSecret) {
        const provider = await this.requireProvider(code);
        if (!this.registry.has(code)) {
            throw new common_1.BadRequestException(`Provider "${code}" is not supported.`);
        }
        const cleanUser = username.trim();
        const cleanPass = password?.trim() || (code === shipping_provider_registry_1.SILA_SY_CODE || code === shipping_provider_registry_1.SENA_EXPRESS_CODE ? 'N/A' : '');
        const cleanSecret = webhookSecret?.trim() || undefined;
        const adapter = this.registry.get(code);
        const test = await adapter.testConnection({ username: cleanUser, password: cleanPass });
        if (!test.ok) {
            throw new common_1.BadRequestException(test.message ?? 'Connection test failed.');
        }
        const encryptedUsername = this.encryption.encrypt(cleanUser);
        const encryptedPassword = this.encryption.encrypt(cleanPass);
        await this.prisma.shippingProviderConnection.upsert({
            where: { providerId: provider.id },
            create: {
                providerId: provider.id,
                status: client_1.ShippingProviderConnectionStatus.connected,
                encryptedUsername,
                encryptedPassword,
                webhookSecret: cleanSecret,
                connectedByUserId: userId,
                lastTestedAt: new Date(),
                lastTestStatus: 'ok',
                lastErrorSafe: null,
            },
            update: {
                status: client_1.ShippingProviderConnectionStatus.connected,
                encryptedUsername,
                encryptedPassword,
                ...(cleanSecret ? { webhookSecret: cleanSecret } : {}),
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
    async ensureShipmentForOutbound(outboundOrderId, opts) {
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
                        codCollectionCurrency: true,
                        babelNeighbourhoodId: true,
                        city: true,
                        district: true,
                        addressLine1: true,
                        shippingServiceId: true,
                        shippingHubId: true,
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
        const ambiguousRow = await this.prisma.carrierShipment.findFirst({
            where: { outboundOrderId, status: client_1.CarrierShipmentStatus.failed },
            orderBy: { createdAt: 'desc' },
            select: { id: true, rawResultMeta: true, lastErrorSafe: true },
        });
        const ambiguousMeta = ambiguousRow?.rawResultMeta;
        const gate = (0, shipping_error_1.mayCreateShipment)({
            hasCreated: false,
            ambiguousOutstanding: ambiguousMeta?.shippingError?.category === 'ambiguous',
            acknowledged: opts?.acknowledgeNoExternalShipment === true,
        });
        if (!gate.allow && gate.reason === 'ambiguous') {
            this.logger.warn(JSON.stringify({
                msg: 'carrier_create_blocked',
                outboundOrderId,
                orderNumber: order.orderNumber,
                claimId: ambiguousRow?.id ?? null,
                category: 'ambiguous',
                field: null,
                outcome: 'blocked',
            }));
            return;
        }
        const existingAwb = order.trackingNumber?.trim() ||
            order.omsOrder?.trackingNumber?.trim() ||
            null;
        const selectedProvider = order.shippingProviderCode?.trim() || shipping_provider_registry_1.BABEL_EXPRESS_CODE;
        const leftoverCarrier = order.carrier ?? order.omsOrder?.carrier ?? null;
        if (existingAwb && leftoverAwbCompatibleWithProvider(selectedProvider, leftoverCarrier)) {
            const otherProviderAwb = await this.prisma.carrierShipment.findFirst({
                where: {
                    outboundOrderId,
                    providerCode: { not: selectedProvider },
                    OR: [{ trackingNumber: existingAwb }, { externalAwb: existingAwb }],
                },
                select: { id: true },
            });
            if (!otherProviderAwb) {
                await this.persistCreatedFromExistingAwb({
                    outboundOrderId,
                    companyId: order.companyId,
                    status: order.status,
                    providerCode: selectedProvider,
                    awb: existingAwb,
                    carrierLabel: leftoverCarrier,
                    omsOrderId: order.omsOrder?.id ?? null,
                });
                return;
            }
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
            const resolvedCoords = this.resolveReceiverCoordinatesFromAddress({
                governorate: order.city ?? order.omsOrder?.city,
                cityRegion: order.district ?? order.omsOrder?.district,
                townNeighborhood: order.addressLine1 ?? order.omsOrder?.addressLine1,
            });
            (0, shipping_config_util_1.assertCarrierShippingReady)({
                shippingMethod: order.shippingMethod,
                shippingProviderCode: order.shippingProviderCode,
                shippingReceiverLat: resolvedCoords?.lat ??
                    (order.shippingReceiverLat != null ? Number(order.shippingReceiverLat) : null),
                shippingReceiverLng: resolvedCoords?.lng ??
                    (order.shippingReceiverLng != null ? Number(order.shippingReceiverLng) : null),
                shippingPackageType: order.shippingPackageType,
                shippingContents: order.shippingContents,
                shippingDeliveryType: order.shippingDeliveryType,
                shippingPickupType: order.shippingPickupType,
                shippingPayer: order.shippingPayer,
                shippingWeightKg: order.shippingWeightKg?.toString() ?? null,
                babelNeighbourhoodId,
            });
            if (resolvedCoords) {
                await this.prisma.outboundOrder.update({
                    where: { id: outboundOrderId },
                    data: {
                        shippingReceiverLat: resolvedCoords.lat,
                        shippingReceiverLng: resolvedCoords.lng,
                        ...(babelNeighbourhoodId != null ? { babelNeighbourhoodId } : {}),
                    },
                });
            }
            else if (babelNeighbourhoodId != null &&
                order.babelNeighbourhoodId == null) {
                await this.prisma.outboundOrder.update({
                    where: { id: outboundOrderId },
                    data: { babelNeighbourhoodId },
                });
            }
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
        const rawCodAmount = oms?.codAmount != null ? oms.codAmount : order.codAmount;
        const orderCurrency = oms?.currency?.trim() ? oms.currency : order.currency;
        const isCod = paymentMethod === 'COD';
        const originalAmount = isCod && rawCodAmount != null ? Number(rawCodAmount) : 0;
        const explicitCollection = oms?.codCollectionCurrency?.trim() || order.codCollectionCurrency?.trim() || '';
        const collectionMode = explicitCollection ? 'explicit' : 'all';
        if (isCod && (!Number.isFinite(originalAmount) || originalAmount <= 0)) {
            await this.failClaim(claimId, outboundOrderId, order.companyId, order.status, 'COD order is missing a collectible amount. Set COD on the OMS order before Send Shipment.');
            return;
        }
        let codAmount = originalAmount;
        let codCurrency = (0, babel_shipment_mapper_1.resolveBabelCodCurrency)(orderCurrency);
        let fxRate = null;
        let fxSource = null;
        let fxAt = null;
        if (isCod) {
            const rate = await this.fx.usableRate();
            const converted = (0, provider_cod_1.resolveCollectionForService)({
                providerCode,
                serviceId: order.shippingServiceId ?? order.omsOrder?.shippingServiceId,
                deliveryType: order.shippingDeliveryType,
                orderAmount: originalAmount,
                orderCurrency,
                requestedCurrency: explicitCollection || orderCurrency,
                mode: collectionMode,
                usdToSypRate: rate?.rate ?? null,
                rateSource: rate?.source ?? null,
                rateAt: rate?.at ?? null,
            });
            if (!converted.ok) {
                const codFailure = (0, shipping_error_1.classifyShippingError)(converted.reason, {
                    providerCode,
                    correlationId: order.omsOrder?.orderNumber ?? order.orderNumber,
                    codAmount: originalAmount,
                    codCurrency: orderCurrency,
                    originalAmount,
                    originalCurrency: orderCurrency,
                    quoteCurrency: order.shippingQuotedCurrency,
                    payer: order.shippingPayer,
                });
                await this.failClaim(claimId, outboundOrderId, order.companyId, order.status, codFailure.message, codFailure);
                return;
            }
            codAmount = converted.amount;
            codCurrency = converted.currency;
            fxRate = converted.rate;
            fxSource = converted.source;
            fxAt = converted.rateAt;
        }
        const pickup = await this.getConfiguredPickupParty();
        if (!pickup) {
            await this.failClaim(claimId, outboundOrderId, order.companyId, order.status, 'Pickup address is not set. A super admin must save it once on Shipping Companies.');
            return;
        }
        const adapter = this.registry.get(providerCode);
        const reference = order.omsOrder?.orderNumber ?? order.orderNumber ?? order.clientReference ?? undefined;
        const located = this.addressResolve.resolveFromAddress({
            governorate: order.city ?? order.omsOrder?.city,
            cityRegion: order.district ?? order.omsOrder?.district,
            townNeighborhood: order.addressLine1 ?? order.omsOrder?.addressLine1,
        });
        const receiverGovernorate = order.city ?? order.omsOrder?.city;
        const receiverCity = located.found && located.cityRegion
            ? located.cityRegion
            : order.district ?? order.omsOrder?.district;
        const receiverNeighborhood = located.found && located.townNeighborhood
            ? located.townNeighborhood
            : order.addressLine1 ?? order.omsOrder?.addressLine1;
        const babelNeighbourhoodId = order.babelNeighbourhoodId ??
            order.omsOrder?.babelNeighbourhoodId ??
            (await this.resolveBabelNeighbourhoodId({
                governorate: located.found && located.governorate ? located.governorate : receiverGovernorate,
                cityRegion: receiverCity,
                townNeighborhood: receiverNeighborhood,
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
        const weightByProductId = new Map((order.lines ?? []).map((line) => [
            line.productId,
            line.product?.weightKg != null && Number(line.product.weightKg) > 0
                ? Number(line.product.weightKg)
                : 0.1,
        ]));
        const savedCartons = (0, shipping_cartons_types_1.parseShippingCartons)(order.shippingPackages);
        const packageType = order.shippingPackageType === 'envelope' ? 'envelope' : 'box';
        const babelParts = savedCartons
            ? (0, shipment_parts_util_1.babelPartsFromCartons)(savedCartons, weightByProductId, packageType)
            : (0, shipment_parts_util_1.toBabelWeightParts)(physicalParts, packageType);
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
        const shipmentReceiverLat = located.found && located.source === 'neighborhood'
            ? located.lat
            : Number(order.shippingReceiverLat) || (located.found ? located.lat : 0);
        const shipmentReceiverLng = located.found && located.source === 'neighborhood'
            ? located.lng
            : Number(order.shippingReceiverLng) || (located.found ? located.lng : 0);
        try {
            const preflight = (0, shipping_preflight_1.preflightCarrierShipment)({
                providerCode: provider.code,
                reference,
                payer: order.shippingPayer,
                codAmount: isCod && Number.isFinite(codAmount) ? codAmount : 0,
                codCurrency,
                quoteCurrency: order.shippingQuotedCurrency,
                receiverName: order.recipientName,
                receiverPhone: (0, shipping_error_1.phoneTail)(order.recipientPhone),
                receiverCity,
                receiverNeighborhood,
                receiverAddress: address.trim(),
                senderName: pickup.name,
                senderPhone: (0, shipping_error_1.phoneTail)(pickup.phoneLocal),
                senderNeighborhood: pickup.neighborhood ?? pickup.address,
                senderNeighborhoodId: pickup.neighbourhoodId,
                senderLat: pickup.lat,
                senderLng: pickup.lng,
                pickupType: 'address',
                deliveryType: order.shippingDeliveryType,
                serviceId: order.shippingServiceId ?? order.omsOrder?.shippingServiceId,
                weightKg,
            });
            if (!preflight.ok) {
                this.logger.warn(JSON.stringify({
                    msg: 'carrier_preflight_stop',
                    outboundOrderId,
                    orderNumber: order.omsOrder?.orderNumber ?? order.orderNumber,
                    provider: provider.code,
                    claimId,
                    category: preflight.failure.category,
                    field: preflight.failure.field,
                    outcome: 'preflight',
                }));
                await this.failClaim(claimId, outboundOrderId, order.companyId, order.status, preflight.failure.message, preflight.failure);
                return;
            }
            const serviceId = order.shippingServiceId ??
                order.omsOrder?.shippingServiceId ??
                undefined;
            const result = await adapter.createShipment({ username, password }, {
                reference,
                serviceId,
                receiver: {
                    name: order.recipientName.trim(),
                    phoneCountry: phone.country,
                    phoneLocal: phone.phone,
                    address: address.trim(),
                    lat: shipmentReceiverLat,
                    lng: shipmentReceiverLng,
                    neighbourhoodId: babelNeighbourhoodId != null ? Number(babelNeighbourhoodId) : undefined,
                    governorate: receiverGovernorate ?? undefined,
                    city: receiverCity ?? undefined,
                    neighborhood: receiverNeighborhood ?? undefined,
                },
                packageType: order.shippingPackageType,
                weightKg: order.shippingPackageType === 'envelope' ? 1 : weightKg,
                parts: babelParts,
                contents: order.shippingContents.trim(),
                deliveryType: order.shippingDeliveryType,
                pickupType: 'address',
                pickup,
                payer: order.shippingPayer,
                codAmount: isCod && Number.isFinite(codAmount) ? codAmount : 0,
                currency: codCurrency,
                items: (order.lines ?? []).map((line) => ({
                    name: line.product?.name ?? 'item',
                    quantity: Math.max(1, Number(line.requestedQuantity) || 1),
                    weight: line.product?.weightKg != null && Number(line.product.weightKg) > 0
                        ? Number(line.product.weightKg)
                        : 0.1,
                })),
                ...(order.shippingDeliveryType === 'hub'
                    ? {
                        hubId: order.shippingHubId ??
                            order.omsOrder?.shippingHubId ??
                            undefined,
                    }
                    : {}),
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
                const courierTracking = result.trackingNumber?.trim() || '';
                const storedTracking = provider.code === 'SILA_SY' ? courierTracking || null : courierTracking || result.awb.trim();
                await tx.carrierShipment.update({
                    where: { id: claimId },
                    data: {
                        externalAwb: result.awb,
                        trackingNumber: storedTracking,
                        status: client_1.CarrierShipmentStatus.created,
                        lastErrorSafe: null,
                        rawResultMeta: {
                            ...(result.raw && typeof result.raw === 'object' ? result.raw : { awb: result.awb }),
                            ...(result.partBarcodes ? { partBarcodes: result.partBarcodes } : {}),
                            codCollection: {
                                originalAmount,
                                originalCurrency: orderCurrency ?? null,
                                amount: codAmount,
                                currency: codCurrency,
                                rate: fxRate,
                                source: fxSource,
                                rateAt: fxAt,
                            },
                        },
                    },
                });
                const identity = confirmedCarrierIdentityPatch({
                    providerCode: provider.code,
                    providerName: provider.name,
                    serviceId: confirmedServiceIdForProvider(provider.code, order),
                    trackingNumber: storedTracking,
                    raw: result.raw ?? { awb: result.awb },
                });
                await tx.outboundOrder.update({
                    where: { id: outboundOrderId },
                    data: {
                        ...identity,
                        shippingPickupType: 'address',
                    },
                });
                if (order.omsOrder?.id) {
                    await tx.omsOrder.update({
                        where: { id: order.omsOrder.id },
                        data: identity,
                    });
                }
            });
            this.emitOutboundShippingUpdate(order.companyId, outboundOrderId, order.status);
        }
        catch (err) {
            const raw = safeErrorMessage(err);
            const failure = (0, shipping_error_1.classifyShippingError)(raw, {
                providerCode: provider.code,
                correlationId: reference,
                payer: order.shippingPayer,
                codAmount,
                codCurrency,
                originalAmount,
                originalCurrency: orderCurrency,
                fxRate,
                quoteCurrency: order.shippingQuotedCurrency,
                receiverNeighborhood: order.addressLine1 ?? order.omsOrder?.addressLine1,
                senderNeighborhood: pickup.neighborhood ?? pickup.address,
            });
            if (failure.category === 'ambiguous' && adapter.findShipmentByReference && reference) {
                try {
                    const found = await adapter.findShipmentByReference({ username, password }, reference);
                    if (found?.awb) {
                        const reconciledTracking = provider.code === 'SILA_SY'
                            ? found.trackingNumber?.trim() || null
                            : found.trackingNumber ?? found.awb;
                        const identity = confirmedCarrierIdentityPatch({
                            providerCode: provider.code,
                            providerName: provider.name,
                            serviceId: confirmedServiceIdForProvider(provider.code, order),
                            trackingNumber: reconciledTracking,
                            raw: { awb: found.awb },
                        });
                        await this.prisma.carrierShipment.update({
                            where: { id: claimId },
                            data: {
                                status: client_1.CarrierShipmentStatus.created,
                                externalAwb: found.awb,
                                trackingNumber: reconciledTracking,
                                lastErrorSafe: null,
                            },
                        });
                        await this.prisma.outboundOrder.update({
                            where: { id: outboundOrderId },
                            data: {
                                ...identity,
                                shippingPickupType: 'address',
                            },
                        });
                        if (order.omsOrder?.id) {
                            await this.prisma.omsOrder.update({
                                where: { id: order.omsOrder.id },
                                data: identity,
                            });
                        }
                        this.logger.warn(JSON.stringify({
                            msg: 'carrier_ambiguous_reconciled',
                            outboundOrderId,
                            orderNumber: order.omsOrder?.orderNumber ?? order.orderNumber,
                            provider: provider.code,
                            claimId,
                            category: 'ambiguous',
                            field: null,
                            outcome: 'created',
                            awb: found.awb,
                        }));
                        this.emitOutboundShippingUpdate(order.companyId, outboundOrderId, order.status);
                        return;
                    }
                }
                catch {
                }
            }
            this.logger.warn(JSON.stringify({
                msg: 'carrier_create_failed',
                outboundOrderId,
                orderNumber: order.omsOrder?.orderNumber ?? order.orderNumber,
                provider: provider.code,
                claimId,
                category: failure.category,
                field: failure.field,
                outcome: 'failed',
                receiverPhoneTail: (0, shipping_error_1.phoneTail)(order.recipientPhone),
            }));
            await this.failClaim(claimId, outboundOrderId, order.companyId, order.status, failure.message, failure);
        }
    }
    async failClaim(claimId, outboundOrderId, companyId, orderStatus, message, failure) {
        const existing = await this.prisma.carrierShipment.findUnique({
            where: { id: claimId },
            select: { rawResultMeta: true },
        });
        await this.prisma.carrierShipment.update({
            where: { id: claimId },
            data: {
                status: client_1.CarrierShipmentStatus.failed,
                lastErrorSafe: (failure ? (0, shipping_error_1.packShippingError)(failure) : message).slice(0, 2000),
                ...(failure
                    ? {
                        rawResultMeta: (0, sila_meta_util_1.mergeShipmentRawMeta)(existing?.rawResultMeta, {
                            shippingError: failure,
                        }),
                    }
                    : {}),
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
    async retryShipment(outboundOrderId, opts) {
        const created = await this.prisma.carrierShipment.findFirst({
            where: { outboundOrderId, status: client_1.CarrierShipmentStatus.created },
        });
        if (created) {
            throw new common_1.BadRequestException('A successful carrier shipment already exists for this outbound order.');
        }
        const latestFailed = await this.prisma.carrierShipment.findFirst({
            where: { outboundOrderId, status: client_1.CarrierShipmentStatus.failed },
            orderBy: { createdAt: 'desc' },
            select: { rawResultMeta: true, lastErrorSafe: true },
        });
        const latestError = latestFailed?.rawResultMeta
            ?.shippingError;
        const retryGate = (0, shipping_error_1.mayCreateShipment)({
            hasCreated: false,
            ambiguousOutstanding: latestError?.category === 'ambiguous',
            acknowledged: opts?.acknowledgeNoExternalShipment === true,
        });
        if (!retryGate.allow && retryGate.reason === 'ambiguous' && latestError) {
            throw new common_1.BadRequestException({
                message: latestFailed?.lastErrorSafe || latestError.message,
                code: latestError.code,
                fields: (0, shipping_error_1.shippingFailureFields)(latestError),
            });
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
        await this.ensureShipmentForOutbound(outboundOrderId, opts);
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
        const adapter = this.registry.has(provider.code) ? this.registry.get(provider.code) : null;
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
            webhookRegistered: Boolean(conn?.webhookSecret?.trim()),
            supportsWebhooks: Boolean(adapter?.capabilities?.supportsWebhooks),
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
        try {
            return {
                provider,
                credentials: {
                    username: this.encryption.decrypt(connection.encryptedUsername),
                    password: this.encryption.decrypt(connection.encryptedPassword),
                },
            };
        }
        catch (err) {
            this.logger.warn(`Failed to decrypt credentials for ${code}: ${err?.message ?? err}`);
            throw new common_1.BadRequestException(`${provider.name} credentials cannot be decrypted. ` +
                `Disconnect and reconnect the provider (re-enter username/password) so they are encrypted with the current server key.`);
        }
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
    async reshipOutboundWithCarrier(params) {
        const { outboundOrderId } = params;
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
                        codCollectionCurrency: true,
                        babelNeighbourhoodId: true,
                        city: true,
                        district: true,
                        addressLine1: true,
                        shippingServiceId: true,
                        shippingHubId: true,
                    },
                },
                carrierShipments: {
                    orderBy: { createdAt: 'desc' },
                },
            },
        });
        if (!order) {
            return { ok: false, message: `Outbound order ${outboundOrderId} not found.` };
        }
        const lastShipment = order.carrierShipments?.[0];
        const providerCode = order.shippingProviderCode?.trim() ||
            lastShipment?.providerCode?.trim() ||
            shipping_provider_registry_1.BABEL_EXPRESS_CODE;
        if (providerCode === 'manual' || order.shippingMethod === client_1.ShippingMethod.manual) {
            const generatedAwb = `RESENT-MANUAL-${Date.now().toString().slice(-6)}`;
            return {
                ok: true,
                awb: generatedAwb,
                trackingNumber: generatedAwb,
                providerCode: 'manual',
                message: 'Manual carrier reshipment recorded.',
            };
        }
        let provider;
        try {
            provider = await this.requireProvider(providerCode);
        }
        catch {
            return { ok: false, message: `Provider ${providerCode} is not configured.` };
        }
        const connection = await this.prisma.shippingProviderConnection.findUnique({
            where: { providerId: provider.id },
        });
        if (!connection ||
            connection.status !== client_1.ShippingProviderConnectionStatus.connected ||
            !connection.encryptedUsername ||
            !connection.encryptedPassword) {
            return { ok: false, message: `${provider.name} is not connected.` };
        }
        let username;
        let password;
        try {
            username = this.encryption.decrypt(connection.encryptedUsername);
            password = this.encryption.decrypt(connection.encryptedPassword);
        }
        catch {
            return { ok: false, message: 'Failed to decrypt provider credentials.' };
        }
        const adapter = this.registry.get(providerCode);
        if (!adapter) {
            return { ok: false, message: `No adapter registered for provider ${providerCode}.` };
        }
        const pickup = await this.getConfiguredPickupParty();
        if (!pickup) {
            return { ok: false, message: 'Pickup origin address is not configured.' };
        }
        const weightKg = Number(order.shippingWeightKg) || 1;
        if (!order.recipientName?.trim()) {
            return { ok: false, message: 'Recipient name is missing.' };
        }
        const phone = (0, babel_shipment_mapper_1.parsePhoneForBabel)(order.recipientPhone, order.shippingPhoneCountry);
        if (!phone) {
            return { ok: false, message: 'Recipient phone number is invalid.' };
        }
        const address = (0, oms_order_mapper_1.composeDestinationAddress)({
            destinationAddress: order.destinationAddress,
            addressLine1: order.addressLine1 ?? undefined,
            addressLine2: order.addressLine2 ?? undefined,
            district: order.district ?? undefined,
            city: order.city ?? undefined,
        }) || order.destinationAddress || '';
        const receiverCity = order.city ?? order.omsOrder?.city;
        const receiverNeighborhood = order.addressLine1 ?? order.omsOrder?.addressLine1;
        const babelNeighbourhoodId = order.babelNeighbourhoodId ?? order.omsOrder?.babelNeighbourhoodId ?? undefined;
        const oms = order.omsOrder;
        const paymentMethod = order.paymentMethod ?? oms?.paymentMethod ?? null;
        const isCod = paymentMethod === 'COD';
        const rawCodAmount = oms?.codAmount != null ? oms.codAmount : order.codAmount;
        const codAmount = isCod && rawCodAmount != null ? Number(rawCodAmount) : 0;
        const orderCurrency = oms?.currency?.trim() ? oms.currency : order.currency;
        const codCurrency = (0, babel_shipment_mapper_1.resolveBabelCodCurrency)(orderCurrency);
        const reference = `${oms?.orderNumber ?? order.orderNumber}-R${Date.now().toString().slice(-4)}`;
        const physicalParts = (0, shipment_parts_util_1.buildPhysicalShipmentParts)((order.lines ?? []).map((line) => ({
            productId: line.productId,
            productName: line.product?.name ?? 'item',
            quantity: Number(line.requestedQuantity),
            weightKg: line.product?.weightKg != null ? Number(line.product.weightKg) : null,
            lengthCm: line.product?.lengthCm != null ? Number(line.product.lengthCm) : null,
            widthCm: line.product?.widthCm != null ? Number(line.product.widthCm) : null,
            heightCm: line.product?.heightCm != null ? Number(line.product.heightCm) : null,
        })));
        const weightByProductId = new Map((order.lines ?? []).map((line) => [
            line.productId,
            line.product?.weightKg != null && Number(line.product.weightKg) > 0
                ? Number(line.product.weightKg)
                : 0.1,
        ]));
        const savedCartons = (0, shipping_cartons_types_1.parseShippingCartons)(order.shippingPackages);
        const packageType = order.shippingPackageType === 'envelope' ? 'envelope' : 'box';
        const babelParts = savedCartons
            ? (0, shipment_parts_util_1.babelPartsFromCartons)(savedCartons, weightByProductId, packageType)
            : (0, shipment_parts_util_1.toBabelWeightParts)(physicalParts, packageType);
        try {
            const result = await adapter.createShipment({ username, password }, {
                reference,
                serviceId: order.shippingServiceId ?? order.omsOrder?.shippingServiceId ?? undefined,
                receiver: {
                    name: order.recipientName.trim(),
                    phoneCountry: phone.country,
                    phoneLocal: phone.phone,
                    address: address.trim(),
                    lat: Number(order.shippingReceiverLat) || 0,
                    lng: Number(order.shippingReceiverLng) || 0,
                    neighbourhoodId: babelNeighbourhoodId != null ? Number(babelNeighbourhoodId) : undefined,
                    governorate: receiverCity ?? undefined,
                    city: order.district ?? undefined,
                    neighborhood: receiverNeighborhood ?? undefined,
                },
                packageType: order.shippingPackageType || 'box',
                weightKg: order.shippingPackageType === 'envelope' ? 1 : weightKg,
                parts: babelParts,
                contents: order.shippingContents?.trim() || 'Items',
                deliveryType: order.shippingDeliveryType || 'address',
                pickupType: 'address',
                pickup,
                payer: order.shippingPayer || 'sender',
                codAmount: isCod && Number.isFinite(codAmount) ? codAmount : 0,
                currency: codCurrency,
                items: (order.lines ?? []).map((line) => ({
                    name: line.product?.name ?? 'item',
                    quantity: Math.max(1, Number(line.requestedQuantity) || 1),
                    weight: line.product?.weightKg != null && Number(line.product.weightKg) > 0
                        ? Number(line.product.weightKg)
                        : 0.1,
                })),
            });
            return {
                ok: true,
                awb: result.awb,
                trackingNumber: result.trackingNumber || result.awb,
                providerCode: provider.code,
                raw: result.raw,
            };
        }
        catch (err) {
            const msg = safeErrorMessage(err);
            this.logger.error(`reshipOutboundWithCarrier failed for order ${order.orderNumber}: ${msg}`, err.stack);
            return {
                ok: false,
                message: msg,
            };
        }
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
        babel_address_adapter_1.BabelAddressAdapter,
        address_resolve_service_1.AddressResolveService,
        shipping_fx_service_1.ShippingFxService])
], ShippingService);
//# sourceMappingURL=shipping.service.js.map