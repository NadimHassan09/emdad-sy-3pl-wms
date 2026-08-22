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
exports.OmsOutboundSyncService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const realtime_service_1 = require("../realtime/realtime.service");
const oms_order_mapper_1 = require("./oms-order.mapper");
const oms_order_events_service_1 = require("./oms-order-events.service");
const oms_order_transitions_1 = require("./oms-order-transitions");
const order_allocation_service_1 = require("./order-allocation.service");
const shipping_config_util_1 = require("../shipping/shipping-config.util");
let OmsOutboundSyncService = class OmsOutboundSyncService {
    prisma;
    events;
    allocation;
    realtime;
    constructor(prisma, events, allocation, realtime) {
        this.prisma = prisma;
        this.events = events;
        this.allocation = allocation;
        this.realtime = realtime;
    }
    async syncFromOutbound(tx, outboundOrderId, actorUserId) {
        const oms = await tx.omsOrder.findFirst({
            where: { outboundOrderId },
            select: {
                id: true,
                companyId: true,
                status: true,
                outboundOrderId: true,
            },
        });
        if (!oms)
            return;
        if (oms_order_transitions_1.OMS_TERMINAL_STATUSES.has(oms.status))
            return;
        if (oms_order_transitions_1.OMS_PRE_FULFILLMENT.has(oms.status))
            return;
        const outbound = await tx.outboundOrder.findUnique({
            where: { id: outboundOrderId },
            select: { id: true, status: true, requiresPacking: true },
        });
        if (!outbound)
            return;
        const next = (0, oms_order_mapper_1.mapOutboundStatusToOms)(outbound.status);
        if (next == null || next === oms.status)
            return;
        const rank = {
            [client_1.OmsOrderStatus.processing]: 1,
            [client_1.OmsOrderStatus.pending]: 1,
            [client_1.OmsOrderStatus.allocated]: 1,
            [client_1.OmsOrderStatus.picking]: 1,
            [client_1.OmsOrderStatus.packing]: 1,
            [client_1.OmsOrderStatus.ready_to_ship]: 2,
            [client_1.OmsOrderStatus.shipped]: 3,
            [client_1.OmsOrderStatus.out_for_delivery]: 3,
        };
        const fromRank = rank[oms.status] ?? 0;
        const toRank = rank[next] ?? 0;
        if (toRank < fromRank)
            return;
        const extra = {};
        if (next === client_1.OmsOrderStatus.shipped) {
            extra.outForDeliveryAt = new Date();
        }
        await tx.omsOrder.update({
            where: { id: oms.id },
            data: { status: next, ...extra },
        });
        const eventType = next === client_1.OmsOrderStatus.shipped
            ? 'oms.shipped'
            : next === client_1.OmsOrderStatus.ready_to_ship
                ? 'oms.ready_to_ship'
                : next === client_1.OmsOrderStatus.processing
                    ? 'oms.processing'
                    : (0, oms_order_mapper_1.omsEventTypeForStatus)(next);
        await this.events.record(tx, {
            omsOrderId: oms.id,
            outboundOrderId,
            companyId: oms.companyId,
            eventType,
            createdBy: actorUserId,
            payload: {
                source: 'wms_sync',
                outboundStatus: outbound.status,
                omsStatus: next,
                requiresPacking: outbound.requiresPacking,
            },
        });
        this.realtime?.emitOmsOrderEvent(oms.companyId, {
            orderId: oms.id,
            status: next,
            event: eventType,
        });
    }
    async syncFromOutboundStandalone(outboundOrderId, actorUserId) {
        await this.prisma.$transaction(async (tx) => {
            await this.syncFromOutbound(tx, outboundOrderId, actorUserId);
        });
    }
    async createOutboundFromOms(tx, params) {
        const oms = await tx.omsOrder.findUnique({
            where: { id: params.omsOrderId },
            include: {
                lines: { orderBy: { lineNumber: 'asc' } },
            },
        });
        if (!oms)
            throw new common_1.NotFoundException('OMS order not found.');
        if (oms.outboundOrderId) {
            const existing = await tx.outboundOrder.findUnique({
                where: { id: oms.outboundOrderId },
                select: { id: true, orderNumber: true },
            });
            if (existing) {
                if (oms.status !== client_1.OmsOrderStatus.processing) {
                    await tx.omsOrder.update({
                        where: { id: oms.id },
                        data: {
                            status: client_1.OmsOrderStatus.processing,
                            approvedAt: oms.approvedAt ?? new Date(),
                            approvedBy: oms.approvedBy ?? params.actorUserId,
                            confirmedAt: oms.confirmedAt ?? new Date(),
                        },
                    });
                }
                return { outboundOrderId: existing.id, orderNumber: existing.orderNumber };
            }
        }
        if (oms.lines.length === 0) {
            throw new common_1.BadRequestException('OMS order has no lines.');
        }
        const destination = (0, oms_order_mapper_1.composeDestinationAddress)({
            destinationAddress: oms.destinationAddress,
            addressLine1: oms.addressLine1 ?? undefined,
            addressLine2: oms.addressLine2 ?? undefined,
            district: oms.district ?? undefined,
            city: oms.city ?? undefined,
        }) ||
            oms.destinationAddress ||
            'OMS order';
        const created = await tx.outboundOrder.create({
            data: {
                companyId: oms.companyId,
                status: client_1.OutboundOrderStatus.draft,
                destinationAddress: destination,
                requiredShipDate: oms.requiredShipDate,
                carrier: oms.carrier,
                clientReference: oms.clientReference,
                notes: oms.notes,
                requiresPacking: oms.requiresPacking,
                createdBy: params.actorUserId,
                recipientName: oms.recipientName,
                recipientPhone: oms.recipientPhone,
                city: oms.city,
                district: oms.district,
                addressLine1: oms.addressLine1,
                addressLine2: oms.addressLine2,
                deliveryInstructions: oms.deliveryInstructions,
                paymentMethod: oms.paymentMethod,
                subtotal: oms.subtotal ?? undefined,
                shippingFee: oms.shippingFee ?? undefined,
                codAmount: oms.codAmount ?? undefined,
                currency: oms.currency ?? 'USD',
                codStatus: oms.codStatus ?? undefined,
                storeChannel: oms.storeChannel,
                externalReference: oms.externalReference,
                ...(0, shipping_config_util_1.copyShippingFieldsFromOms)(oms),
                lines: {
                    create: oms.lines.map((l) => ({
                        productId: l.productId,
                        requestedQuantity: l.requestedQuantity,
                        specificLotId: l.specificLotId,
                        lineNumber: l.lineNumber,
                        unitPrice: l.unitPrice ?? undefined,
                        lineTotal: l.lineTotal ?? undefined,
                        discountAmount: l.discountAmount ?? undefined,
                    })),
                },
            },
            include: { lines: true },
        });
        if (this.allocation.isEnabled()) {
            await this.allocation.allocateOrder(tx, {
                outboundOrderId: created.id,
                companyId: oms.companyId,
                actorUserId: params.actorUserId,
                previousStatus: created.status,
                lines: created.lines.map((line) => ({
                    outboundOrderLineId: line.id,
                    productId: line.productId,
                    requestedQty: line.requestedQuantity,
                    specificLotId: line.specificLotId,
                })),
            });
        }
        await tx.omsOrder.update({
            where: { id: oms.id },
            data: {
                outboundOrderId: created.id,
                status: client_1.OmsOrderStatus.processing,
                approvedAt: new Date(),
                approvedBy: params.actorUserId,
                confirmedAt: new Date(),
                ...(this.allocation.isEnabled()
                    ? {
                        allocationStatus: client_1.OmsAllocationStatus.allocated,
                        allocatedAt: new Date(),
                    }
                    : {}),
            },
        });
        await this.events.record(tx, {
            omsOrderId: oms.id,
            outboundOrderId: created.id,
            companyId: oms.companyId,
            eventType: 'oms.approved',
            createdBy: params.actorUserId,
            payload: {
                outboundOrderId: created.id,
                outboundOrderNumber: created.orderNumber,
                omsStatus: client_1.OmsOrderStatus.processing,
            },
        });
        await this.events.record(tx, {
            omsOrderId: oms.id,
            outboundOrderId: created.id,
            companyId: oms.companyId,
            eventType: 'outbound.created',
            createdBy: params.actorUserId,
            payload: { outboundOrderId: created.id, outboundOrderNumber: created.orderNumber },
        });
        this.realtime?.emitOmsOrderEvent(oms.companyId, {
            orderId: oms.id,
            status: client_1.OmsOrderStatus.processing,
            event: 'oms.approved',
        });
        return { outboundOrderId: created.id, orderNumber: created.orderNumber };
    }
};
exports.OmsOutboundSyncService = OmsOutboundSyncService;
exports.OmsOutboundSyncService = OmsOutboundSyncService = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        oms_order_events_service_1.OmsOrderEventsService,
        order_allocation_service_1.OrderAllocationService,
        realtime_service_1.RealtimeService])
], OmsOutboundSyncService);
//# sourceMappingURL=oms-outbound-sync.service.js.map