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
exports.OrderAllocationService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const client_1 = require("@prisma/client");
const domain_exceptions_1 = require("../../common/errors/domain-exceptions");
const task_allocation_helper_1 = require("../warehouse-workflow/task-allocation.helper");
const feature_flags_1 = require("../warehouse-workflow/feature-flags");
const oms_order_events_service_1 = require("./oms-order-events.service");
let OrderAllocationService = class OrderAllocationService {
    config;
    events;
    constructor(config, events) {
        this.config = config;
        this.events = events;
    }
    isEnabled() {
        return (0, feature_flags_1.allocateOnOrderCreate)(this.config);
    }
    async hasActiveReservations(tx, outboundOrderId) {
        const count = await tx.stockReservation.count({
            where: { outboundOrderId, status: client_1.ReservationStatus.active },
        });
        return count > 0;
    }
    async loadActiveReservationSnapshots(tx, outboundOrderId) {
        const rows = await tx.stockReservation.findMany({
            where: { outboundOrderId, status: client_1.ReservationStatus.active },
            include: {
                location: { select: { warehouseId: true } },
            },
        });
        return rows.map((r) => ({
            outboundOrderLineId: r.outboundOrderLineId ?? '',
            companyId: r.companyId,
            productId: r.productId,
            locationId: r.locationId,
            warehouseId: r.location.warehouseId,
            lotId: r.lotId,
            quantity: r.quantity.toString(),
        }));
    }
    async allocateOrder(tx, params) {
        if (!this.isEnabled())
            return;
        const existingRows = await tx.stockReservation.findMany({
            where: {
                outboundOrderId: params.outboundOrderId,
                status: client_1.ReservationStatus.active,
            },
            select: {
                outboundOrderLineId: true,
                productId: true,
                quantity: true,
            },
        });
        const reservedByLineId = new Map();
        for (const row of existingRows) {
            const key = row.outboundOrderLineId ?? `product:${row.productId}`;
            const prev = reservedByLineId.get(key) ?? new client_1.Prisma.Decimal(0);
            reservedByLineId.set(key, prev.plus(row.quantity));
        }
        let createdAny = false;
        for (const line of params.lines) {
            const already = reservedByLineId.get(line.outboundOrderLineId) ??
                reservedByLineId.get(`product:${line.productId}`) ??
                new client_1.Prisma.Decimal(0);
            let remaining = new client_1.Prisma.Decimal(line.requestedQty.toString()).minus(already);
            if (remaining.lessThanOrEqualTo(0))
                continue;
            const candidates = params.warehouseId
                ? await (0, task_allocation_helper_1.findWarehouseStockFefo)(tx, params.companyId, params.warehouseId, line.productId, line.specificLotId)
                : await (0, task_allocation_helper_1.findCompanyStockFefo)(tx, params.companyId, line.productId, line.specificLotId);
            for (const row of candidates) {
                if (remaining.lessThanOrEqualTo(0))
                    break;
                const take = client_1.Prisma.Decimal.min(remaining, row.quantityAvailable);
                if (take.lessThanOrEqualTo(0))
                    continue;
                await tx.stockReservation.create({
                    data: {
                        companyId: params.companyId,
                        productId: line.productId,
                        locationId: row.locationId,
                        lotId: row.lotId,
                        outboundOrderId: params.outboundOrderId,
                        outboundOrderLineId: line.outboundOrderLineId,
                        quantity: take,
                        status: client_1.ReservationStatus.active,
                    },
                });
                createdAny = true;
                remaining = remaining.minus(take);
            }
            if (remaining.greaterThan(0)) {
                throw new domain_exceptions_1.InsufficientStockException();
            }
        }
        if (!createdAny && existingRows.length > 0) {
            return;
        }
        const allocatableStatuses = [
            client_1.OutboundOrderStatus.draft,
            client_1.OutboundOrderStatus.confirmed,
            client_1.OutboundOrderStatus.pending_stock,
        ];
        const canSetAllocated = !params.previousStatus || allocatableStatuses.includes(params.previousStatus);
        await tx.outboundOrder.update({
            where: { id: params.outboundOrderId },
            data: {
                allocationStatus: client_1.OmsAllocationStatus.allocated,
                allocatedAt: new Date(),
                ...(canSetAllocated ? { status: client_1.OutboundOrderStatus.allocated } : {}),
            },
        });
        if (createdAny || existingRows.length === 0) {
            await this.events.record(tx, {
                outboundOrderId: params.outboundOrderId,
                companyId: params.companyId,
                eventType: 'order.allocated',
                createdBy: params.actorUserId,
                payload: {
                    lineCount: params.lines.length,
                    reusedExisting: existingRows.length > 0,
                },
            });
        }
    }
    async sumActiveReservedForProduct(tx, outboundOrderId, productId) {
        const agg = await tx.stockReservation.aggregate({
            where: {
                outboundOrderId,
                productId,
                status: client_1.ReservationStatus.active,
            },
            _sum: { quantity: true },
        });
        return agg._sum.quantity ?? new client_1.Prisma.Decimal(0);
    }
    async releaseAllocation(tx, params) {
        const active = await tx.stockReservation.findMany({
            where: {
                outboundOrderId: params.outboundOrderId,
                status: client_1.ReservationStatus.active,
            },
        });
        if (active.length === 0)
            return;
        await tx.stockReservation.updateMany({
            where: {
                outboundOrderId: params.outboundOrderId,
                status: client_1.ReservationStatus.active,
            },
            data: { status: client_1.ReservationStatus.released },
        });
        await tx.outboundOrder.update({
            where: { id: params.outboundOrderId },
            data: { allocationStatus: client_1.OmsAllocationStatus.released },
        });
        await this.events.record(tx, {
            outboundOrderId: params.outboundOrderId,
            companyId: params.companyId,
            eventType: 'inventory.released',
            createdBy: params.actorUserId,
            payload: { reservationCount: active.length },
        });
    }
    async fulfillReservations(tx, params) {
        const active = await tx.stockReservation.count({
            where: {
                outboundOrderId: params.outboundOrderId,
                status: client_1.ReservationStatus.active,
            },
        });
        if (active === 0)
            return;
        await tx.stockReservation.updateMany({
            where: {
                outboundOrderId: params.outboundOrderId,
                status: client_1.ReservationStatus.active,
            },
            data: { status: client_1.ReservationStatus.fulfilled },
        });
        await tx.outboundOrder.update({
            where: { id: params.outboundOrderId },
            data: { allocationStatus: client_1.OmsAllocationStatus.fulfilled },
        });
        await this.events.record(tx, {
            outboundOrderId: params.outboundOrderId,
            companyId: params.companyId,
            eventType: 'inventory.fulfilled',
            createdBy: params.actorUserId,
            payload: { reservationCount: active },
        });
    }
    async assertAllocatable(tx, outboundOrderId) {
        const order = await tx.outboundOrder.findUnique({
            where: { id: outboundOrderId },
            select: { status: true, allocationStatus: true },
        });
        if (!order)
            throw new common_1.BadRequestException('Order not found.');
        if (order.allocationStatus === client_1.OmsAllocationStatus.allocated) {
            throw new common_1.BadRequestException('Order is already allocated.');
        }
        if (order.status === client_1.OutboundOrderStatus.shipped ||
            order.status === client_1.OutboundOrderStatus.delivered ||
            order.status === client_1.OutboundOrderStatus.cancelled) {
            throw new common_1.BadRequestException(`Cannot allocate order in status ${order.status}.`);
        }
    }
};
exports.OrderAllocationService = OrderAllocationService;
exports.OrderAllocationService = OrderAllocationService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        oms_order_events_service_1.OmsOrderEventsService])
], OrderAllocationService);
//# sourceMappingURL=order-allocation.service.js.map