"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.returnListItemPayload = returnListItemPayload;
exports.returnDetailPayload = returnDetailPayload;
exports.cycleCountListItemPayload = cycleCountListItemPayload;
exports.cycleCountDetailPayload = cycleCountDetailPayload;
exports.adjustmentPayload = adjustmentPayload;
exports.transferPayload = transferPayload;
const return_line_integrity_util_1 = require("../returns/return-line-integrity.util");
function iso(d) {
    if (d == null)
        return null;
    return d instanceof Date ? d.toISOString() : d;
}
function dec(v) {
    return String(v ?? '0');
}
function returnListItemPayload(order) {
    const lines = order.lines ?? [];
    return {
        id: order.id,
        companyId: order.companyId,
        orderNumber: order.orderNumber,
        status: order.status,
        clientReference: order.clientReference,
        shipmentReference: order.shipmentReference,
        createdAt: iso(order.createdAt),
        completedAt: iso(order.completedAt),
        company: order.company,
        originalOutbound: order.originalOutbound ?? null,
        _count: order._count ?? { lines: lines.length },
        summary: (0, return_line_integrity_util_1.buildReturnListSummary)(lines.map((l) => ({
            expectedQuantity: l.expectedQuantity,
            receivedQuantity: l.receivedQuantity,
            disposition: l.disposition,
            product: l.product,
        }))),
    };
}
function returnDetailPayload(order) {
    const lines = order.lines ?? [];
    const list = returnListItemPayload({
        ...order,
        lines: lines,
    });
    return {
        ...list,
        warehouseId: order.warehouseId ?? null,
        notes: order.notes ?? null,
        confirmedAt: iso(order.confirmedAt),
        receivingStartedAt: iso(order.receivingStartedAt),
        inspectingStartedAt: iso(order.inspectingStartedAt),
        cancelledAt: iso(order.cancelledAt),
        warehouse: order.warehouse ?? null,
        package: order.package ?? null,
        lines: lines.map((l) => ({
            id: l.id,
            returnOrderId: l.returnOrderId ?? order.id,
            productId: l.productId,
            outboundOrderLineId: l.outboundOrderLineId ?? null,
            packageId: l.packageId ?? null,
            lotId: l.lotId ?? null,
            expectedQuantity: dec(l.expectedQuantity),
            receivedQuantity: dec(l.receivedQuantity),
            postedQuantity: dec(l.postedQuantity),
            lineStatus: l.lineStatus,
            condition: l.condition ?? null,
            disposition: l.disposition ?? null,
            targetLocationId: l.targetLocationId ?? null,
            inspectionNotes: l.inspectionNotes ?? null,
            inspectedAt: iso(l.inspectedAt),
            postedAt: iso(l.postedAt),
            lineNumber: l.lineNumber,
            product: l.product,
            lot: l.lot ?? null,
            outboundOrderLine: l.outboundOrderLine ?? null,
            package: l.package ?? null,
            targetLocation: l.targetLocation ?? null,
        })),
    };
}
function cycleCountListItemPayload(count) {
    return {
        id: count.id,
        companyId: count.companyId,
        warehouseId: count.warehouseId,
        status: count.status,
        source: count.source,
        snapshotAt: iso(count.snapshotAt),
        startedAt: iso(count.startedAt),
        completedAt: iso(count.completedAt),
        createdAt: iso(count.createdAt),
        company: count.company,
        warehouse: count.warehouse,
        assignedWorker: count.assignedWorker ?? null,
        schedule: count.schedule ?? null,
        _count: count._count ?? { lines: count.lines?.length ?? 0 },
    };
}
function cycleCountDetailPayload(count) {
    const lines = count.lines ?? [];
    const list = cycleCountListItemPayload({
        ...count,
        lines,
    });
    return {
        ...list,
        blindCount: count.blindCount ?? false,
        notes: count.notes ?? null,
        creator: count.creator,
        lines: lines.map((l) => ({
            id: l.id,
            productId: l.productId,
            locationId: l.locationId,
            lotId: l.lotId ?? null,
            expectedQuantity: dec(l.expectedQuantity),
            actualQuantity: l.actualQuantity != null ? dec(l.actualQuantity) : null,
            discrepancyQuantity: l.discrepancyQuantity != null ? dec(l.discrepancyQuantity) : null,
            status: l.status,
            assignedWorkerId: l.assignedWorkerId ?? null,
            countedAt: iso(l.countedAt),
            countNotes: l.countNotes ?? null,
            product: l.product,
            location: l.location,
            lot: l.lot ?? null,
            assignedWorker: l.assignedWorker ?? null,
            counter: l.counter ?? null,
        })),
        variancesDetected: count.variancesDetected,
    };
}
function adjustmentPayload(adj) {
    const lines = adj.lines ?? [];
    return {
        id: adj.id,
        companyId: adj.companyId,
        warehouseId: adj.warehouseId,
        reason: adj.reason,
        status: adj.status,
        approvedBy: adj.approvedBy ?? null,
        approvedAt: iso(adj.approvedAt),
        createdBy: adj.createdBy,
        createdAt: iso(adj.createdAt),
        updatedAt: iso(adj.updatedAt),
        company: adj.company,
        warehouse: adj.warehouse,
        creator: adj.creator,
        approver: adj.approver ?? null,
        lines: lines.map((l) => ({
            id: l.id,
            adjustmentId: l.adjustmentId ?? adj.id,
            productId: l.productId,
            locationId: l.locationId,
            lotId: l.lotId ?? null,
            quantityBefore: dec(l.quantityBefore),
            quantityAfter: dec(l.quantityAfter),
            reasonNote: l.reasonNote ?? null,
            product: l.product,
            location: l.location,
            lot: l.lot ?? null,
        })),
    };
}
function transferPayload(input) {
    return {
        referenceId: input.referenceId,
        companyId: input.companyId,
        warehouseId: input.warehouseId,
        productId: input.productId,
        fromLocationId: input.fromLocationId,
        toLocationId: input.toLocationId,
        lotId: input.lotId,
        quantity: input.quantity,
        status: input.status,
        ledger: input.ledger,
    };
}
//# sourceMappingURL=realtime-ops.payload.js.map