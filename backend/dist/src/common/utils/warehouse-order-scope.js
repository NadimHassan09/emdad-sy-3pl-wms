"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inboundIdsVisibleForWarehouse = inboundIdsVisibleForWarehouse;
exports.outboundIdsVisibleForWarehouse = outboundIdsVisibleForWarehouse;
const INBOUND_ACTIVE = [
    'draft',
    'confirmed',
    'in_progress',
    'partially_received',
];
const OUTBOUND_ACTIVE = ['draft', 'pending_stock', 'confirmed', 'picking', 'packing', 'ready_to_ship'];
async function inboundIdsVisibleForWarehouse(prisma, warehouseId, baseWhere) {
    const locIds = (await prisma.location.findMany({
        where: { warehouseId, status: 'active' },
        select: { id: true },
    })).map((l) => l.id);
    const receivedHere = locIds.length === 0
        ? []
        : await prisma.inventoryLedger.findMany({
            where: {
                referenceType: 'inbound_order',
                movementType: 'inbound_receive',
                toLocationId: { in: locIds },
            },
            distinct: ['referenceId'],
            select: { referenceId: true },
        });
    const anyInboundReceive = await prisma.inventoryLedger.findMany({
        where: {
            referenceType: 'inbound_order',
            movementType: 'inbound_receive',
        },
        distinct: ['referenceId'],
        select: { referenceId: true },
    });
    const touched = new Set(anyInboundReceive.map((r) => r.referenceId));
    const touchedArray = [...touched];
    const neverReceivedOrders = await prisma.inboundOrder.findMany({
        where: {
            ...baseWhere,
            status: { in: INBOUND_ACTIVE },
            ...(touchedArray.length ? { id: { notIn: touchedArray } } : {}),
        },
        select: { id: true },
    });
    const idSet = new Set([...receivedHere.map((r) => r.referenceId), ...neverReceivedOrders.map((o) => o.id)].filter(Boolean));
    return idSet.size ? { id: { in: [...idSet] } } : { id: { in: [] } };
}
async function outboundIdsVisibleForWarehouse(prisma, warehouseId, baseWhere) {
    const locIds = (await prisma.location.findMany({
        where: { warehouseId, status: 'active' },
        select: { id: true },
    })).map((l) => l.id);
    const pickedHere = locIds.length === 0
        ? []
        : await prisma.inventoryLedger.findMany({
            where: {
                referenceType: 'outbound_order',
                movementType: 'outbound_pick',
                fromLocationId: { in: locIds },
            },
            distinct: ['referenceId'],
            select: { referenceId: true },
        });
    const anyPick = await prisma.inventoryLedger.findMany({
        where: {
            referenceType: 'outbound_order',
            movementType: 'outbound_pick',
        },
        distinct: ['referenceId'],
        select: { referenceId: true },
    });
    const touched = new Set(anyPick.map((r) => r.referenceId));
    const touchedArray = [...touched];
    const neverPickedOrders = await prisma.outboundOrder.findMany({
        where: {
            ...baseWhere,
            status: { in: OUTBOUND_ACTIVE },
            ...(touchedArray.length ? { id: { notIn: touchedArray } } : {}),
        },
        select: { id: true },
    });
    const idSet = new Set([...pickedHere.map((r) => r.referenceId), ...neverPickedOrders.map((o) => o.id)].filter(Boolean));
    return idSet.size ? { id: { in: [...idSet] } } : { id: { in: [] } };
}
//# sourceMappingURL=warehouse-order-scope.js.map