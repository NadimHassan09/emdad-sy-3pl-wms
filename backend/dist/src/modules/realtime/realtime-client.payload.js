"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminInboundListItem = adminInboundListItem;
exports.adminOutboundListItem = adminOutboundListItem;
function adminInboundListItem(order) {
    const lineCount = order._count?.lines ?? (Array.isArray(order.lines) ? order.lines.length : 0);
    return {
        id: order.id,
        companyId: order.companyId,
        orderNumber: order.orderNumber,
        status: order.status,
        expectedArrivalDate: order.expectedArrivalDate instanceof Date
            ? order.expectedArrivalDate.toISOString().slice(0, 10)
            : String(order.expectedArrivalDate).slice(0, 10),
        createdAt: order.createdAt instanceof Date ? order.createdAt.toISOString() : String(order.createdAt),
        notes: order.notes ?? null,
        confirmedAt: order.confirmedAt?.toISOString() ?? null,
        completedAt: order.completedAt?.toISOString() ?? null,
        cancelledAt: order.cancelledAt?.toISOString() ?? null,
        company: order.company,
        lines: order.lines,
        _count: { lines: lineCount },
    };
}
function adminOutboundListItem(order) {
    const lineCount = order._count?.lines ?? (Array.isArray(order.lines) ? order.lines.length : 0);
    return {
        id: order.id,
        companyId: order.companyId,
        orderNumber: order.orderNumber,
        status: order.status,
        destinationAddress: order.destinationAddress ?? '',
        requiredShipDate: order.requiredShipDate instanceof Date
            ? order.requiredShipDate.toISOString().slice(0, 10)
            : String(order.requiredShipDate).slice(0, 10),
        createdAt: order.createdAt instanceof Date ? order.createdAt.toISOString() : String(order.createdAt),
        carrier: order.carrier ?? null,
        trackingNumber: order.trackingNumber ?? null,
        notes: order.notes ?? null,
        requiresPacking: order.requiresPacking ?? true,
        confirmedAt: order.confirmedAt?.toISOString() ?? null,
        shippedAt: order.shippedAt?.toISOString() ?? null,
        cancelledAt: order.cancelledAt?.toISOString() ?? null,
        company: order.company,
        lines: order.lines,
        _count: { lines: lineCount },
    };
}
//# sourceMappingURL=realtime-client.payload.js.map