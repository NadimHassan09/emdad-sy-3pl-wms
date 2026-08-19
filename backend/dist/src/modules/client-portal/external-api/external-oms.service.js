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
const geo_polygon_util_1 = require("../../shipping/geo-polygon.util");
const shipping_geo_service_1 = require("../../shipping/shipping-geo.service");
const client_oms_orders_service_1 = require("../oms/client-oms-orders.service");
const api_validation_1 = require("./api-validation");
const public_order_serialize_1 = require("./public-order.serialize");
const syria_address_1 = require("./syria-address");
let ExternalOmsService = class ExternalOmsService {
    oms;
    geo;
    constructor(oms, geo) {
        this.oms = oms;
        this.geo = geo;
    }
    async create(client, dto) {
        const externalOrderId = dto.externalOrderId.trim();
        const existing = await this.oms.findByExternalReference(client, externalOrderId);
        if (existing) {
            const order = await this.oms.findOne(client, existing.id);
            return { ...(0, public_order_serialize_1.publicOmsOrder)(order), idempotentReplay: true };
        }
        const address = (0, syria_address_1.resolveSyriaAddress)(dto.address);
        if (!address.ok) {
            (0, api_validation_1.throwApiValidation)('Delivery address is invalid.', address.fields);
        }
        const coords = await this.resolveCoordinates(address.value);
        const products = await this.oms.resolveSkus(client.companyId, dto.lines.map((l) => l.sku));
        try {
            const created = await this.oms.createFromApi(client, {
                requiredShipDate: dto.requiredShipDate,
                recipientName: dto.recipientName,
                recipientPhone: dto.recipientPhone,
                shippingPhoneCountry: dto.shippingPhoneCountry,
                city: address.value.governorate,
                district: address.value.city,
                addressLine1: address.value.neighborhood ?? undefined,
                addressLine2: address.value.street ?? undefined,
                notes: dto.notes,
                storeChannel: dto.storeChannel,
                paymentMethod: dto.paymentMethod,
                currency: dto.currency ?? 'USD',
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