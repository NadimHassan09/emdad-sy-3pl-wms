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
exports.TaskInventoryEffectsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const storage_location_types_1 = require("../../common/constants/storage-location-types");
const domain_exceptions_1 = require("../../common/errors/domain-exceptions");
const location_operational_1 = require("../../common/utils/location-operational");
const ledger_idempotency_service_1 = require("../inventory/ledger-idempotency.service");
const stock_helpers_1 = require("../inventory/stock.helpers");
const task_allocation_helper_1 = require("./task-allocation.helper");
let TaskInventoryEffectsService = class TaskInventoryEffectsService {
    stock;
    ledgerDedup;
    constructor(stock, ledgerDedup) {
        this.stock = stock;
        this.ledgerDedup = ledgerDedup;
    }
    async buildPickReservations(tx, companyId, warehouseId, lines) {
        const reservations = [];
        for (const line of lines) {
            let remaining = new client_1.Prisma.Decimal(line.requestedQty.toString());
            const candidates = await (0, task_allocation_helper_1.findWarehouseStockFefo)(tx, companyId, warehouseId, line.productId, line.specificLotId);
            for (const row of candidates) {
                if (remaining.lessThanOrEqualTo(0))
                    break;
                const take = client_1.Prisma.Decimal.min(remaining, row.quantityAvailable);
                if (take.lessThanOrEqualTo(0))
                    continue;
                await this.stock.incrementReservedWithMeta(tx, {
                    companyId,
                    productId: line.productId,
                    locationId: row.locationId,
                    lotId: row.lotId,
                    quantity: take.toString(),
                });
                reservations.push({
                    outboundOrderLineId: line.outboundOrderLineId,
                    companyId,
                    productId: line.productId,
                    locationId: row.locationId,
                    warehouseId: row.warehouseId,
                    lotId: row.lotId,
                    quantity: take.toString(),
                });
                remaining = remaining.minus(take);
            }
            if (remaining.greaterThan(0)) {
                throw new common_1.BadRequestException(`Insufficient stock to reserve pick for line ${line.outboundOrderLineId}.`);
            }
        }
        return reservations;
    }
    async releaseReservations(tx, rows) {
        for (const r of rows) {
            await this.stock.releaseReservedWithMeta(tx, {
                companyId: r.companyId,
                productId: r.productId,
                locationId: r.locationId,
                lotId: r.lotId,
                quantity: r.quantity,
            });
        }
    }
    async applyReceivingStaging(tx, operatorId, taskId, inboundOrderId, companyId, body, stagingByLineId) {
        const order = await tx.inboundOrder.findUnique({
            where: { id: inboundOrderId },
            include: { lines: { include: { product: true } } },
        });
        if (!order)
            throw new common_1.BadRequestException('Inbound order not found.');
        if (order.companyId !== companyId) {
            throw new common_1.BadRequestException('Order company mismatch.');
        }
        for (const l of body.lines) {
            const line = order.lines.find((x) => x.id === l.inbound_order_line_id);
            if (!line)
                throw new common_1.BadRequestException(`Unknown inbound line ${l.inbound_order_line_id}`);
            const stagingLocationId = stagingByLineId.get(l.inbound_order_line_id);
            if (!stagingLocationId) {
                throw new common_1.BadRequestException(`Missing staging location for line ${l.inbound_order_line_id} in task payload.`);
            }
            const location = await tx.location.findUnique({
                where: { id: stagingLocationId },
                select: { id: true, warehouseId: true, status: true },
            });
            if (!location)
                throw new common_1.BadRequestException('Staging location not found.');
            (0, location_operational_1.assertLocationUsableForInventoryMove)(location.status);
            const qty = new client_1.Prisma.Decimal(l.received_qty);
            const expected = line.expectedQuantity;
            if (qty.greaterThan(expected) && !body.allow_short_close) {
                throw new common_1.BadRequestException(`Received qty exceeds expected for line ${line.id} (${qty.toString()} > ${expected.toString()}).`);
            }
            let lotId = l.lot_id ?? null;
            if (line.product.trackingType === 'lot') {
                let ln = (l.capture_lot_number ?? '').trim();
                if (!lotId && !ln && line.expectedLotNumber?.trim()) {
                    ln = line.expectedLotNumber.trim();
                }
                if (!lotId && !ln)
                    throw new domain_exceptions_1.LotRequiredException();
                if (!lotId && ln) {
                    const found = await tx.lot.findUnique({
                        where: { productId_lotNumber: { productId: line.productId, lotNumber: ln } },
                    });
                    lotId =
                        found?.id ??
                            (await tx.lot.create({
                                data: { productId: line.productId, lotNumber: ln },
                            })).id;
                }
            }
            const stockMeta = await this.stock.upsertPositiveWithMeta(tx, {
                companyId,
                productId: line.productId,
                locationId: stagingLocationId,
                warehouseId: location.warehouseId,
                lotId,
                quantity: qty.toString(),
            });
            const idemKey = `${taskId}:receiving:${line.id}:inbound_receive`;
            await this.ledgerDedup.appendIfAbsent(tx, idemKey, {
                companyId,
                productId: line.productId,
                lotId,
                fromLocationId: null,
                toLocationId: stagingLocationId,
                movementType: client_1.MovementType.inbound_receive,
                quantity: qty,
                quantityBefore: stockMeta.before,
                quantityAfter: stockMeta.after,
                referenceType: 'inbound_order',
                referenceId: inboundOrderId,
                operatorId,
            });
            await tx.inboundOrderLine.update({
                where: { id: line.id },
                data: {
                    receivedQuantity: { increment: qty },
                    ...(qty.lessThan(expected)
                        ? {
                            discrepancyType: 'short',
                            discrepancyNotes: l.discrepancy_notes ?? undefined,
                        }
                        : {}),
                },
            });
        }
        await this.refreshInboundOrderStatus(tx, inboundOrderId);
    }
    async applyPutaway(tx, operatorId, taskId, inboundOrderId, companyId, body, sourceByLineId, opts) {
        const movementType = opts?.movementType ?? client_1.MovementType.putaway;
        const quarantineBinsOnly = opts?.quarantineBinsOnly ?? false;
        const order = await tx.inboundOrder.findUnique({
            where: { id: inboundOrderId },
            include: { lines: { include: { product: true } } },
        });
        if (!order || order.companyId !== companyId) {
            throw new common_1.BadRequestException('Inbound order invalid for putaway.');
        }
        for (const l of body.lines) {
            const src = sourceByLineId.get(l.inbound_order_line_id);
            if (!src) {
                throw new common_1.BadRequestException(`Missing putaway source for line ${l.inbound_order_line_id}.`);
            }
            const inboundLine = order.lines.find((row) => row.id === l.inbound_order_line_id);
            if (!inboundLine) {
                throw new common_1.BadRequestException(`Unknown inbound line ${l.inbound_order_line_id} for putaway.`);
            }
            const qty = new client_1.Prisma.Decimal(l.putaway_quantity);
            const dest = await tx.location.findUnique({
                where: { id: l.destination_location_id },
                select: { warehouseId: true, type: true, status: true },
            });
            if (!dest)
                throw new common_1.BadRequestException('Destination location not found.');
            (0, location_operational_1.assertLocationUsableForInventoryMove)(dest.status);
            const srcLoc = await tx.location.findUnique({
                where: { id: src.locationId },
                select: { status: true },
            });
            if (!srcLoc)
                throw new common_1.BadRequestException('Putaway source location not found.');
            (0, location_operational_1.assertLocationUsableForInventoryMove)(srcLoc.status);
            if (quarantineBinsOnly) {
                if (!(0, storage_location_types_1.isQuarantineStorageLocationType)(dest.type)) {
                    throw new domain_exceptions_1.InvalidLocationTypeException('Quarantine putaway requires a quarantine or scrap bin.');
                }
            }
            else {
                const allowedSellablePutaway = new Set(['internal', 'fridge', 'quarantine', 'scrap']);
                if (!allowedSellablePutaway.has(String(dest.type))) {
                    throw new domain_exceptions_1.InvalidLocationTypeException('Putaway destination must be storage (internal), fridge, quarantine, or scrap.');
                }
            }
            let lotId = l.lot_id ?? src.lotId ?? null;
            if (inboundLine.product.trackingType === client_1.ProductTrackingType.lot && !lotId) {
                const resolved = await this.resolvePutawayLotFromStaging(tx, companyId, src.productId, src.locationId, qty);
                if (!resolved) {
                    throw new common_1.BadRequestException('Putaway could not resolve a staged lot for this line (legacy tasks omitted lot_id). Ensure inventory exists at the staging bin for this product/lot or recreate the putaway task.');
                }
                lotId = resolved;
            }
            const dec = await this.stock.decrementWithMeta(tx, {
                companyId,
                productId: src.productId,
                locationId: src.locationId,
                lotId,
                quantity: qty.toString(),
            });
            const inc = await this.stock.upsertPositiveWithMeta(tx, {
                companyId,
                productId: src.productId,
                locationId: l.destination_location_id,
                warehouseId: dest.warehouseId,
                lotId,
                quantity: qty.toString(),
            });
            const idemKey = `${taskId}:${movementType}:${l.inbound_order_line_id}:${l.destination_location_id}`;
            await this.ledgerDedup.appendIfAbsent(tx, idemKey, {
                companyId,
                productId: src.productId,
                lotId,
                fromLocationId: src.locationId,
                toLocationId: l.destination_location_id,
                movementType,
                quantity: qty,
                quantityBefore: dec.before,
                quantityAfter: inc.after,
                referenceType: 'inbound_order',
                referenceId: inboundOrderId,
                operatorId,
            });
        }
    }
    async applyPickRecord(tx, orderId, reservations, body) {
        this.assertPickCompletionMatchesReservations(reservations, body);
        const byLineId = new Map();
        for (const r of reservations) {
            const cur = byLineId.get(r.outboundOrderLineId) ?? [];
            cur.push(r);
            byLineId.set(r.outboundOrderLineId, cur);
        }
        for (const grp of body.picks) {
            const pickedTotal = grp.lines.reduce((acc, p) => acc.plus(new client_1.Prisma.Decimal(String(p.quantity))), new client_1.Prisma.Decimal(0));
            await tx.outboundOrderLine.update({
                where: { id: grp.outbound_order_line_id },
                data: {
                    pickedQuantity: pickedTotal,
                    status: 'done',
                },
            });
        }
        await tx.outboundOrder.update({
            where: { id: orderId },
            data: {
                status: 'packing',
            },
        });
    }
    async applyDispatchShip(tx, operatorId, taskId, outboundOrderId, companyId, reservations, body) {
        const order = await tx.outboundOrder.findUnique({
            where: { id: outboundOrderId },
            include: { lines: true },
        });
        if (!order || order.companyId !== companyId)
            throw new common_1.BadRequestException('Outbound order invalid.');
        const uniqueLocIds = [...new Set(reservations.map((r) => r.locationId))];
        const locRows = await tx.location.findMany({
            where: { id: { in: uniqueLocIds } },
            select: { id: true, status: true },
        });
        for (const lr of locRows) {
            (0, location_operational_1.assertLocationUsableForInventoryMove)(lr.status);
        }
        for (const l of body.lines) {
            const line = order.lines.find((x) => x.id === l.outbound_order_line_id);
            if (!line)
                throw new common_1.BadRequestException(`Unknown outbound line ${l.outbound_order_line_id}`);
            const ship = new client_1.Prisma.Decimal(l.ship_qty);
            if (!ship.equals(line.pickedQuantity)) {
                throw new common_1.BadRequestException(`Ship qty must match picked qty for line ${line.id}.`);
            }
        }
        for (const r of reservations) {
            const meta = await this.stock.decrementShippedWithMeta(tx, {
                companyId: r.companyId,
                productId: r.productId,
                locationId: r.locationId,
                lotId: r.lotId,
                quantity: r.quantity,
            });
            const idemKey = `${taskId}:dispatch:${r.outboundOrderLineId}:${r.locationId}:${r.lotId ?? 'null'}:${r.quantity}`;
            await this.ledgerDedup.appendIfAbsent(tx, idemKey, {
                companyId: r.companyId,
                productId: r.productId,
                lotId: r.lotId,
                fromLocationId: r.locationId,
                toLocationId: null,
                movementType: client_1.MovementType.outbound_pick,
                quantity: new client_1.Prisma.Decimal(r.quantity),
                quantityBefore: meta.before,
                quantityAfter: meta.after,
                referenceType: 'outbound_order',
                referenceId: outboundOrderId,
                operatorId,
            });
        }
        await tx.outboundOrder.update({
            where: { id: outboundOrderId },
            data: {
                status: 'shipped',
                shippedAt: new Date(),
                carrier: body.carrier ?? order.carrier,
                trackingNumber: body.tracking ?? order.trackingNumber,
            },
        });
    }
    async applyQcLines(tx, inboundOrderId, body) {
        for (const row of body.lines) {
            const line = await tx.inboundOrderLine.findFirst({
                where: { id: row.inbound_order_line_id, inboundOrderId },
            });
            if (!line)
                throw new common_1.BadRequestException(`QC line not found: ${row.inbound_order_line_id}.`);
            const failed = new client_1.Prisma.Decimal(String(row.failed_qty));
            const status = failed.greaterThan(0) ? client_1.InboundQcStatus.failed : client_1.InboundQcStatus.passed;
            await tx.inboundOrderLine.update({
                where: { id: line.id },
                data: { qcStatus: status },
            });
        }
    }
    async applyPackRecord(tx, outboundOrderId, body) {
        for (const l of body.lines) {
            const line = await tx.outboundOrderLine.findFirst({
                where: { id: l.outbound_order_line_id, outboundOrderId },
            });
            if (!line)
                throw new common_1.BadRequestException(`Unknown line ${l.outbound_order_line_id}`);
            const packed = new client_1.Prisma.Decimal(l.packed_qty);
            if (packed.greaterThan(line.pickedQuantity)) {
                throw new common_1.BadRequestException('Packed qty cannot exceed picked qty.');
            }
        }
        await tx.outboundOrder.update({
            where: { id: outboundOrderId },
            data: { status: 'ready_to_ship' },
        });
    }
    assertPickCompletionMatchesReservations(reservations, body) {
        const normLot = (v) => v === undefined || v === null || v === '' ? null : v;
        const qtyEq = (a, b) => new client_1.Prisma.Decimal(a).equals(new client_1.Prisma.Decimal(b));
        const byLineId = new Map();
        for (const r of reservations) {
            const cur = byLineId.get(r.outboundOrderLineId) ?? [];
            cur.push(r);
            byLineId.set(r.outboundOrderLineId, cur);
        }
        const expectedLineIds = new Set(byLineId.keys());
        const seenLineIds = new Set();
        for (const grp of body.picks) {
            seenLineIds.add(grp.outbound_order_line_id);
            const reserved = byLineId.get(grp.outbound_order_line_id);
            if (!reserved?.length) {
                throw new common_1.BadRequestException(`Pick completion references unknown outbound line ${grp.outbound_order_line_id}.`);
            }
            const remaining = [...reserved];
            for (const pl of grp.lines) {
                const idx = remaining.findIndex((r) => r.locationId === pl.location_id &&
                    normLot(r.lotId) === normLot(pl.lot_id) &&
                    qtyEq(r.quantity, String(pl.quantity)));
                if (idx < 0) {
                    throw new common_1.BadRequestException(`Pick completion must match reserved allocations (FEFO/FIFO). Offending outbound line ${grp.outbound_order_line_id}: each slice must match reservation location, lot, and quantity.`);
                }
                remaining.splice(idx, 1);
            }
            if (remaining.length > 0) {
                throw new common_1.BadRequestException(`Incomplete pick for outbound line ${grp.outbound_order_line_id}: submit every reserved slice.`);
            }
        }
        for (const lid of expectedLineIds) {
            if (!seenLineIds.has(lid)) {
                throw new common_1.BadRequestException(`Missing pick group for outbound line ${lid}.`);
            }
        }
    }
    async resolvePutawayLotFromStaging(tx, companyId, productId, stagingLocationId, qty) {
        const rows = await tx.currentStock.findMany({
            where: {
                companyId,
                productId,
                locationId: stagingLocationId,
                packageId: null,
                lotId: { not: null },
                quantityAvailable: { gt: 0 },
            },
            select: { lotId: true, quantityAvailable: true },
            orderBy: { quantityAvailable: 'desc' },
        });
        const covering = rows.find((r) => new client_1.Prisma.Decimal(r.quantityAvailable.toString()).greaterThanOrEqualTo(qty));
        return covering?.lotId ?? null;
    }
    async refreshInboundOrderStatus(tx, orderId) {
        const order = await tx.inboundOrder.findUnique({
            where: { id: orderId },
            include: { lines: true },
        });
        if (!order)
            return;
        const anyReceived = order.lines.some((l) => l.receivedQuantity.greaterThan(0));
        if (!anyReceived)
            return;
        const allFullyReceived = order.lines.every((l) => l.receivedQuantity.greaterThanOrEqualTo(l.expectedQuantity));
        if (!['confirmed', 'in_progress', 'partially_received'].includes(order.status)) {
            return;
        }
        const next = allFullyReceived ? 'in_progress' : 'partially_received';
        if (next !== order.status) {
            await tx.inboundOrder.update({ where: { id: orderId }, data: { status: next } });
        }
    }
};
exports.TaskInventoryEffectsService = TaskInventoryEffectsService;
exports.TaskInventoryEffectsService = TaskInventoryEffectsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [stock_helpers_1.StockHelpers,
        ledger_idempotency_service_1.LedgerIdempotencyService])
], TaskInventoryEffectsService);
//# sourceMappingURL=task-inventory-effects.service.js.map