"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isUuidLike = isUuidLike;
exports.publicOmsOrderListItem = publicOmsOrderListItem;
exports.publicOmsOrder = publicOmsOrder;
exports.publicInboundOrderListItem = publicInboundOrderListItem;
exports.publicInboundOrder = publicInboundOrder;
exports.publicOutboundOrderListItem = publicOutboundOrderListItem;
exports.publicOutboundOrder = publicOutboundOrder;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuidLike(value) {
    return UUID_RE.test(value.trim());
}
function lineProduct(line) {
    const product = line.product;
    const imageUrl = product?.imageUrl ??
        (product?.imagePath ? `/media/${String(product.imagePath).replace(/^\/+/, '')}` : null);
    return {
        sku: product?.sku ?? (typeof line.sku === 'string' ? line.sku : null),
        name: product?.name ?? null,
        imageUrl: imageUrl ?? null,
    };
}
function num(value) {
    if (value == null || value === '')
        return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}
function str(value) {
    if (value == null)
        return null;
    const s = String(value);
    return s.length ? s : null;
}
function externalOrderIdOf(order) {
    return str(order.externalReference) ?? str(order.clientReference);
}
function publicOmsOrderListItem(order) {
    return {
        orderNumber: order.orderNumber,
        status: order.status,
        recipientName: order.recipientName ?? null,
        city: order.city ?? null,
        total: str(order.total),
        currency: order.currency ?? null,
        createdAt: order.createdAt ?? null,
        incomplete: Boolean(order.needsInformation),
        externalOrderId: externalOrderIdOf(order),
    };
}
function publicOmsOrder(order) {
    return {
        orderNumber: order.orderNumber,
        status: order.status,
        externalOrderId: externalOrderIdOf(order),
        recipientName: order.recipientName ?? null,
        recipientPhone: order.recipientPhone ?? null,
        address: order.addressLine1 ?? order.destinationAddress ?? null,
        city: order.city ?? null,
        district: order.district ?? null,
        carrier: order.carrier ?? null,
        trackingNumber: order.trackingNumber ?? null,
        requiredShipDate: order.requiredShipDate ?? null,
        createdAt: order.createdAt ?? null,
        warehouseStatus: order.warehouseStatus ?? null,
        notes: order.notes ?? null,
        paymentMethod: order.paymentMethod ?? null,
        shippingFee: str(order.shippingFee),
        subtotal: str(order.subtotal),
        currency: order.currency ?? null,
        codStatus: order.codStatus ?? null,
        incomplete: Boolean(order.needsInformation),
        rejectionReason: order.rejectionReason ?? null,
        submittedAt: order.submittedAt ?? null,
        confirmedAt: order.confirmedAt ?? null,
        approvedAt: order.approvedAt ?? null,
        outForDeliveryAt: order.outForDeliveryAt ?? null,
        deliveredAt: order.deliveredAt ?? null,
        lines: (order.lines ?? []).map((line) => {
            const p = lineProduct(line);
            return {
                lineNumber: num(line.lineNumber),
                sku: p.sku,
                productName: p.name,
                quantity: num(line.requestedQuantity ?? line.quantity) ?? 0,
                unitPrice: num(line.unitPrice),
                lineTotal: num(line.lineTotal),
            };
        }),
        timeline: (order.timeline ?? []).map((ev) => ({
            eventType: str(ev.eventType),
            createdAt: ev.createdAt ?? null,
        })),
    };
}
function publicInboundOrderListItem(order) {
    const lineCount = order._count?.lines ??
        (Array.isArray(order.lines) ? order.lines.length : null);
    return {
        orderNumber: order.orderNumber,
        status: order.status,
        expectedArrivalDate: order.expectedArrivalDate ?? null,
        lines: lineCount,
        createdAt: order.createdAt ?? null,
        externalOrderId: externalOrderIdOf(order),
    };
}
function publicInboundOrder(order) {
    const lines = order.lines ?? [];
    const skuCount = new Set(lines.map((l) => lineProduct(l).sku || str(l.productId) || '').filter(Boolean)).size;
    return {
        orderNumber: order.orderNumber,
        status: order.status,
        externalOrderId: externalOrderIdOf(order),
        expectedArrivalDate: order.expectedArrivalDate ?? null,
        createdAt: order.createdAt ?? null,
        confirmedAt: order.confirmedAt ?? null,
        completedAt: order.completedAt ?? null,
        notes: order.notes ?? null,
        skuCount,
        lines: lines.map((line) => {
            const p = lineProduct(line);
            return {
                lineNumber: num(line.lineNumber),
                productName: p.name,
                sku: p.sku,
                imageUrl: p.imageUrl,
                expectedQuantity: num(line.expectedQuantity ?? line.quantity) ?? 0,
                receivedQuantity: num(line.receivedQuantity) ?? 0,
            };
        }),
    };
}
function publicOutboundOrderListItem(order) {
    const lineCount = order._count?.lines ??
        (Array.isArray(order.lines) ? order.lines.length : null);
    return {
        orderNumber: order.orderNumber,
        status: order.status,
        recipientName: order.recipientName ?? null,
        requiredShipDate: order.requiredShipDate ?? null,
        lines: lineCount,
        createdAt: order.createdAt ?? null,
        externalOrderId: externalOrderIdOf(order),
    };
}
function publicOutboundOrder(order) {
    return {
        orderNumber: order.orderNumber,
        status: order.status,
        externalOrderId: externalOrderIdOf(order),
        destination: order.destinationAddress ?? null,
        requiredShipDate: order.requiredShipDate ?? null,
        carrier: order.carrier ?? null,
        trackingNumber: order.trackingNumber ?? null,
        createdAt: order.createdAt ?? null,
        confirmedAt: order.confirmedAt ?? null,
        shippedAt: order.shippedAt ?? null,
        notes: order.notes ?? null,
        lines: (order.lines ?? []).map((line) => {
            const p = lineProduct(line);
            return {
                lineNumber: num(line.lineNumber),
                productName: p.name,
                sku: p.sku,
                imageUrl: p.imageUrl,
                requestedQuantity: num(line.requestedQuantity ?? line.quantity) ?? 0,
                pickedQuantity: num(line.pickedQuantity) ?? 0,
            };
        }),
    };
}
//# sourceMappingURL=public-order.serialize.js.map