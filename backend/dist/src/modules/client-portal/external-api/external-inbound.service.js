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
exports.ExternalInboundService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const client_inbound_orders_service_1 = require("../inbound/client-inbound-orders.service");
const client_oms_orders_service_1 = require("../oms/client-oms-orders.service");
const public_order_serialize_1 = require("./public-order.serialize");
let ExternalInboundService = class ExternalInboundService {
    inbound;
    oms;
    constructor(inbound, oms) {
        this.inbound = inbound;
        this.oms = oms;
    }
    async create(client, dto) {
        const externalOrderId = dto.externalOrderId.trim();
        const existing = await this.inbound.findByExternalReference(client, externalOrderId);
        if (existing) {
            const order = await this.inbound.findOne(client, existing.id);
            return { ...(0, public_order_serialize_1.publicInboundOrder)(order), idempotentReplay: true };
        }
        const products = await this.oms.resolveSkus(client.companyId, dto.lines.map((l) => l.sku));
        try {
            const created = await this.inbound.create(client, {
                expectedArrivalDate: dto.expectedArrivalDate,
                clientReference: dto.clientReference,
                notes: dto.notes,
                externalReference: externalOrderId,
                lines: dto.lines.map((l) => ({
                    productId: products.get(l.sku.trim().toUpperCase()),
                    expectedQuantity: l.quantity,
                })),
            });
            const order = await this.inbound.findOne(client, created.id);
            return { ...(0, public_order_serialize_1.publicInboundOrder)(order), idempotentReplay: false };
        }
        catch (err) {
            if (err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
                const again = await this.inbound.findByExternalReference(client, externalOrderId);
                if (again) {
                    const order = await this.inbound.findOne(client, again.id);
                    return { ...(0, public_order_serialize_1.publicInboundOrder)(order), idempotentReplay: true };
                }
            }
            throw err;
        }
    }
    async findOne(client, id) {
        const order = await this.inbound.findOne(client, id);
        return (0, public_order_serialize_1.publicInboundOrder)(order);
    }
    async findByExternalOrderId(client, externalOrderId) {
        const existing = await this.inbound.findByExternalReference(client, externalOrderId.trim());
        if (!existing)
            return null;
        const order = await this.inbound.findOne(client, existing.id);
        return (0, public_order_serialize_1.publicInboundOrder)(order);
    }
};
exports.ExternalInboundService = ExternalInboundService;
exports.ExternalInboundService = ExternalInboundService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [client_inbound_orders_service_1.ClientInboundOrdersService,
        client_oms_orders_service_1.ClientOmsOrdersService])
], ExternalInboundService);
//# sourceMappingURL=external-inbound.service.js.map