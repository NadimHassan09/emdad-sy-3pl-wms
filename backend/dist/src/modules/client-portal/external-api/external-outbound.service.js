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
const oms_order_mapper_1 = require("../../oms/oms-order.mapper");
const client_oms_orders_service_1 = require("../oms/client-oms-orders.service");
const client_outbound_orders_service_1 = require("../outbound/client-outbound-orders.service");
const api_validation_1 = require("./api-validation");
const public_order_serialize_1 = require("./public-order.serialize");
const syria_address_1 = require("./syria-address");
let ExternalOutboundService = class ExternalOutboundService {
    outbound;
    oms;
    constructor(outbound, oms) {
        this.outbound = outbound;
        this.oms = oms;
    }
    async create(client, dto) {
        const externalOrderId = dto.externalOrderId.trim();
        const existing = await this.outbound.findByExternalReference(client, externalOrderId);
        if (existing) {
            const order = await this.outbound.findOne(client, existing.id);
            return { ...(0, public_order_serialize_1.publicOutboundOrder)(order), idempotentReplay: true };
        }
        let destination = dto.destinationAddress?.trim() || '';
        if (dto.address) {
            const address = (0, syria_address_1.resolveSyriaAddress)(dto.address);
            if (!address.ok) {
                (0, api_validation_1.throwApiValidation)('Destination address is invalid.', address.fields);
            }
            destination =
                destination ||
                    (0, oms_order_mapper_1.composeDestinationAddress)({
                        city: address.value.governorate,
                        district: address.value.city,
                        addressLine1: address.value.neighborhood ?? undefined,
                        addressLine2: address.value.street ?? undefined,
                    });
        }
        if (!destination) {
            (0, api_validation_1.throwApiValidation)('Destination address is required.', {
                destinationAddress: 'Provide destinationAddress or a structured address.',
            });
        }
        const products = await this.oms.resolveSkus(client.companyId, dto.lines.map((l) => l.sku));
        try {
            const created = await this.outbound.create(client, {
                destinationAddress: destination,
                requiredShipDate: dto.requiredShipDate,
                clientReference: dto.clientReference,
                notes: dto.notes,
                externalReference: externalOrderId,
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
};
exports.ExternalOutboundService = ExternalOutboundService;
exports.ExternalOutboundService = ExternalOutboundService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [client_outbound_orders_service_1.ClientOutboundOrdersService,
        client_oms_orders_service_1.ClientOmsOrdersService])
], ExternalOutboundService);
//# sourceMappingURL=external-outbound.service.js.map