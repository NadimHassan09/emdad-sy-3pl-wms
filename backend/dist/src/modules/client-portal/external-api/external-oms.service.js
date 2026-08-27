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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExternalOmsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const order_planning_date_1 = require("../../../common/utils/order-planning-date");
const geo_polygon_util_1 = require("../../shipping/geo-polygon.util");
const shipping_geo_service_1 = require("../../shipping/shipping-geo.service");
const client_oms_orders_service_1 = require("../oms/client-oms-orders.service");
const oms_client_import_validation_1 = require("../order-import/oms-client-import.validation");
const api_validation_1 = require("./api-validation");
const public_order_serialize_1 = require("./public-order.serialize");
const syria_address_1 = require("./syria-address");
function parseApiShipDate(raw) {
    const t = raw.trim();
    const iso = /^(\d{4}-\d{2}-\d{2})$/.exec(t);
    if (iso) {
        const ymd = iso[1];
        const [y, m, d] = ymd.split('-').map(Number);
        const dt = new Date(Date.UTC(y, m - 1, d));
        if (dt.getUTCFullYear() !== y ||
            dt.getUTCMonth() !== m - 1 ||
            dt.getUTCDate() !== d) {
            return { ok: false, message: 'requiredShipDate is not a valid calendar date.' };
        }
        return { ok: true, ymd };
    }
    return (0, oms_client_import_validation_1.parseImportMdYDate)(t, 'requiredShipDate');
}
let ExternalOmsService = class ExternalOmsService {
    oms;
    geo;
    constructor(oms, geo) {
        this.oms = oms;
        this.geo = geo;
    }
    async create(client, dto) {
        const orderNumberResult = (0, oms_client_import_validation_1.validateImportOrderNumber)(dto.externalOrderId);
        if (!orderNumberResult.ok) {
            (0, api_validation_1.throwApiValidation)('Order payload is invalid.', {
                externalOrderId: orderNumberResult.message,
            });
        }
        const externalOrderId = orderNumberResult.value;
        const existing = await this.oms.findByExternalReference(client, externalOrderId);
        if (existing) {
            const order = await this.oms.findOne(client, existing.id);
            return { ...(0, public_order_serialize_1.publicOmsOrder)(order), idempotentReplay: true };
        }
        const shipDate = parseApiShipDate(dto.requiredShipDate);
        if (!shipDate.ok) {
            (0, api_validation_1.throwApiValidation)('Order payload is invalid.', {
                requiredShipDate: shipDate.message,
            });
        }
        if (shipDate.ymd < (0, order_planning_date_1.calendarTodayYmdServerLocal)()) {
            (0, api_validation_1.throwApiValidation)('Order payload is invalid.', {
                requiredShipDate: 'requiredShipDate cannot be before today.',
            });
        }
        const nameResult = (0, oms_client_import_validation_1.validateImportRecipientName)(dto.recipientName);
        if (!nameResult.ok) {
            (0, api_validation_1.throwApiValidation)('Order payload is invalid.', {
                recipientName: nameResult.message,
            });
        }
        const countryResult = (0, oms_client_import_validation_1.validateImportCountryCode)(dto.countryCode);
        if (!countryResult.ok) {
            (0, api_validation_1.throwApiValidation)('Order payload is invalid.', {
                countryCode: countryResult.message,
            });
        }
        const phoneResult = (0, oms_client_import_validation_1.validateImportRecipientPhone)(dto.recipientPhone, countryResult.iso);
        if (!phoneResult.ok) {
            (0, api_validation_1.throwApiValidation)('Order payload is invalid.', {
                recipientPhone: phoneResult.message,
            });
        }
        if (!dto.address?.neighborhood?.trim()) {
            (0, api_validation_1.throwApiValidation)('Order payload is incomplete.', {
                'address.neighborhood': 'Neighborhood is required.',
            });
        }
        const address = (0, syria_address_1.resolveSyriaAddress)({
            governorate: dto.address.governorate,
            city: dto.address.city,
            neighborhood: dto.address.neighborhood,
            street: dto.address.street,
        });
        if (!address.ok) {
            (0, api_validation_1.throwApiValidation)('Delivery address is invalid.', address.fields);
        }
        if (!address.value.neighborhood?.trim()) {
            (0, api_validation_1.throwApiValidation)('Order payload is incomplete.', {
                'address.neighborhood': 'Neighborhood is required and must match the Client Portal address list (Arabic).',
            });
        }
        const coords = await this.resolveCoordinates({
            governorate: address.value.governorate,
            city: address.value.city,
            neighborhood: address.value.neighborhood,
        });
        const products = await this.oms.resolveSkus(client.companyId, dto.lines.map((l) => l.sku));
        const seenSkus = new Set();
        for (const line of dto.lines) {
            const skuKey = line.sku.trim().toUpperCase();
            if (seenSkus.has(skuKey)) {
                (0, api_validation_1.throwApiValidation)('Order payload is invalid.', {
                    sku: `Duplicate SKU "${line.sku}" in the same order. Each product can only appear once.`,
                });
            }
            seenSkus.add(skuKey);
            if (line.unitPrice == null || !Number.isInteger(line.unitPrice) || line.unitPrice < 0) {
                (0, api_validation_1.throwApiValidation)('Order payload is incomplete.', {
                    unitPrice: 'Unit price is required and must be a whole number ≥ 0.',
                });
            }
        }
        try {
            const created = await this.oms.createFromApi(client, {
                requiredShipDate: shipDate.ymd,
                recipientName: nameResult.value,
                recipientPhone: phoneResult.e164,
                shippingPhoneCountry: phoneResult.shippingPhoneCountry,
                city: address.value.governorate,
                district: address.value.city,
                addressLine1: address.value.neighborhood,
                addressLine2: address.value.street ?? undefined,
                notes: dto.notes,
                storeChannel: dto.storeChannel,
                paymentMethod: dto.paymentMethod,
                currency: 'USD',
                externalReference: externalOrderId,
                clientReference: externalOrderId,
                shippingReceiverLat: coords.lat,
                shippingReceiverLng: coords.lng,
                lines: dto.lines.map((l) => ({
                    productId: products.get(l.sku.trim().toUpperCase()),
                    requestedQuantity: l.quantity,
                    unitPrice: l.unitPrice,
                })),
            });
            const confirmed = await this.oms.confirm(client, created.id);
            return { ...(0, public_order_serialize_1.publicOmsOrder)(confirmed), idempotentReplay: false };
        }
        catch (err) {
            if (err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
                const again = await this.oms.findByExternalReference(client, externalOrderId);
                if (again) {
                    const order = await this.oms.findOne(client, again.id);
                    return { ...(0, public_order_serialize_1.publicOmsOrder)(order), idempotentReplay: true };
                }
            }
            throw err;
        }
    }
    async list(client, query) {
        const page = await this.oms.list(client, query);
        return {
            items: page.items.map((row) => (0, public_order_serialize_1.publicOmsOrderListItem)(row)),
            total: page.total,
            limit: page.limit,
            offset: page.offset,
        };
    }
    async findOne(client, id) {
        const order = await this.oms.findOne(client, id);
        return (0, public_order_serialize_1.publicOmsOrder)(order);
    }
    async findByExternalOrderId(client, externalOrderId) {
        const existing = await this.oms.findByExternalReference(client, externalOrderId.trim());
        if (!existing)
            return null;
        const order = await this.oms.findOne(client, existing.id);
        return (0, public_order_serialize_1.publicOmsOrder)(order);
    }
    async findByOrderNumber(client, orderNumber) {
        const existing = await this.oms.findByOrderNumber(client, orderNumber.trim());
        if (!existing)
            return null;
        const order = await this.oms.findOne(client, existing.id);
        return (0, public_order_serialize_1.publicOmsOrder)(order);
    }
    async findOneByLookup(client, lookup) {
        const orderNumber = lookup.orderNumber?.trim() || undefined;
        const externalOrderId = lookup.externalOrderId?.trim() || undefined;
        const idOrNumber = lookup.idOrNumber?.trim() || undefined;
        if (idOrNumber && (0, public_order_serialize_1.isUuidLike)(idOrNumber)) {
            try {
                return await this.findOne(client, idOrNumber);
            }
            catch (err) {
                if (!(err instanceof common_1.NotFoundException))
                    throw err;
            }
        }
        const numberKey = orderNumber || (idOrNumber && !(0, public_order_serialize_1.isUuidLike)(idOrNumber) ? idOrNumber : undefined);
        if (numberKey) {
            const byNumber = await this.findByOrderNumber(client, numberKey);
            if (byNumber)
                return byNumber;
        }
        if (externalOrderId) {
            const byExt = await this.findByExternalOrderId(client, externalOrderId);
            if (byExt)
                return byExt;
        }
        if (idOrNumber && !(0, public_order_serialize_1.isUuidLike)(idOrNumber) && !orderNumber) {
            const byExt = await this.findByExternalOrderId(client, idOrNumber);
            if (byExt)
                return byExt;
        }
        return null;
    }
    async resolveCoordinates(address) {
        const boundary = await this.geo.lookupBoundary({
            governorate: address.governorate,
            city: address.city,
            neighborhood: address.neighborhood,
        });
        if (!boundary) {
            (0, api_validation_1.throwApiValidation)('The delivery address could not be resolved to map coordinates.', {
                address: 'Could not geocode this governorate/city. Check the spelling and try again.',
            });
        }
        let point = (0, geo_polygon_util_1.bboxCentroid)(boundary.bbox);
        if (!this.geo.containsPoint(boundary, point)) {
            point = {
                lat: boundary.bbox.south + (boundary.bbox.north - boundary.bbox.south) * 0.35,
                lng: boundary.bbox.west + (boundary.bbox.east - boundary.bbox.west) * 0.5,
            };
        }
        if (!this.geo.containsPoint(boundary, point)) {
            (0, api_validation_1.throwApiValidation)('The delivery address could not be resolved to valid map coordinates.', {
                address: 'Resolved area did not produce a point inside the delivery boundary.',
            });
        }
        return point;
    }
};
exports.ExternalOmsService = ExternalOmsService;
exports.ExternalOmsService = ExternalOmsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [client_oms_orders_service_1.ClientOmsOrdersService,
        shipping_geo_service_1.ShippingGeoService])
], ExternalOmsService);
//# sourceMappingURL=external-oms.service.js.map