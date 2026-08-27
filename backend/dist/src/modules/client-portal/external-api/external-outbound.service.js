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
exports.ExternalOutboundService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const client_oms_orders_service_1 = require("../oms/client-oms-orders.service");
const client_outbound_orders_service_1 = require("../outbound/client-outbound-orders.service");
const external_api_payload_util_1 = require("./external-api-payload.util");
const public_order_serialize_1 = require("./public-order.serialize");
let ExternalOutboundService = class ExternalOutboundService {
    outbound;
    oms;
    constructor(outbound, oms) {
        this.outbound = outbound;
        this.oms = oms;
    }
    async create(client, dto) {
        const externalOrderId = (0, external_api_payload_util_1.assertExternalOrderId)(dto.externalOrderId);
        const existing = await this.outbound.findByExternalReference(client, externalOrderId);
        if (existing) {
            const order = await this.outbound.findOne(client, existing.id);
            return { ...(0, public_order_serialize_1.publicOutboundOrder)(order), idempotentReplay: true };
        }
        const destination = String(dto.destination ?? dto.destinationAddress ?? '').trim();
        if (!destination) {
            throw new common_1.BadRequestException('destination is required.');
        }
        const requiredShipDate = (0, external_api_payload_util_1.parseExternalApiDate)(dto.requiredShipDate, 'requiredShipDate');
        (0, external_api_payload_util_1.assertExternalApiDateNotBeforeToday)(requiredShipDate, 'requiredShipDate');
        (0, external_api_payload_util_1.assertUniqueSkus)(dto.lines.map((l) => l.sku));
        const products = await this.oms.resolveSkus(client.companyId, dto.lines.map((l) => l.sku));
        try {
            const created = await this.outbound.create(client, {
                destinationAddress: destination,
                requiredShipDate,
                carrier: dto.carrier?.trim() || undefined,
                notes: dto.notes?.trim() || undefined,
                externalReference: externalOrderId,
                clientReference: externalOrderId,
                lines: dto.lines.map((l) => ({
                    productId: products.get(l.sku.trim().toUpperCase()),
                    requestedQuantity: l.quantity,
                })),
            });
            const order = await this.outbound.findOne(client, created.id);
            return { ...(0, public_order_serialize_1.publicOutboundOrder)(order), idempotentReplay: false };
        }
        catch (err) {
            if (err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
                const again = await this.outbound.findByExternalReference(client, externalOrderId);
                if (again) {
                    const order = await this.outbound.findOne(client, again.id);
                    return { ...(0, public_order_serialize_1.publicOutboundOrder)(order), idempotentReplay: true };
                }
            }
            throw err;
        }
    }
    async list(client, query) {
        const page = await this.outbound.list(client, query);
        return {
            items: page.items.map((row) => (0, public_order_serialize_1.publicOutboundOrderListItem)(row)),
            total: page.total,
            limit: page.limit,
            offset: page.offset,
        };
    }
    async findOne(client, id) {
        const order = await this.outbound.findOne(client, id);
        return (0, public_order_serialize_1.publicOutboundOrder)(order);
    }
    async findByExternalOrderId(client, externalOrderId) {
        const existing = await this.outbound.findByExternalReference(client, externalOrderId.trim());
        if (!existing)
            return null;
        const order = await this.outbound.findOne(client, existing.id);
        return (0, public_order_serialize_1.publicOutboundOrder)(order);
    }
    async findByOrderNumber(client, orderNumber) {
        const existing = await this.outbound.findByOrderNumber(client, orderNumber.trim());
        if (!existing)
            return null;
        const order = await this.outbound.findOne(client, existing.id);
        return (0, public_order_serialize_1.publicOutboundOrder)(order);
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
};
exports.ExternalOutboundService = ExternalOutboundService;
exports.ExternalOutboundService = ExternalOutboundService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [client_outbound_orders_service_1.ClientOutboundOrdersService,
        client_oms_orders_service_1.ClientOmsOrdersService])
], ExternalOutboundService);
//# sourceMappingURL=external-outbound.service.js.map