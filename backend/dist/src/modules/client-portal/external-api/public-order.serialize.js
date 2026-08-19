"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.publicOmsOrder = publicOmsOrder;
exports.publicInboundOrder = publicInboundOrder;
exports.publicOutboundOrder = publicOutboundOrder;
function lineSku(line) {
    const product = line.product;
    return product?.sku ?? (typeof line.sku === 'string' ? line.sku : null);
}
function publicOmsOrder(order) {
    return {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        externalOrderId: order.externalReference ?? null,
        recipientName: order.recipientName ?? null,
        recipientPhone: order.recipientPhone ?? null,
        address: {
            governorate: order.city ?? null,
            city: order.district ?? null,
            neighborhood: order.addressLine1 ?? null,
            street: order.addressLine2 ?? null,
        },
        requiredShipDate: order.requiredShipDate ?? null,
        paymentMethod: order.paymentMethod ?? null,
        currency: order.currency ?? null,
        notes: order.notes ?? null,
        storeChannel: order.storeChannel ?? null,
        coordinates: order.shippingReceiverLat != null && order.shippingReceiverLng != null
            ? { lat: Number(order.shippingReceiverLat), lng: Number(order.shippingReceiverLng) }
            : null,
        createdAt: order.createdAt ?? null,
        lines: (order.lines ?? []).map((line) => ({
            sku: lineSku(line),
            quantity: Number(line.requestedQuantity ?? line.quantity ?? 0),
            unitPrice: line.unitPrice != null ? Number(line.unitPrice) : null,
        })),
    };
}
function publicInboundOrder(order) {
    return {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        externalOrderId: order.externalReference ?? null,
        clientReference: order.clientReference ?? null,
        expectedArrivalDate: order.expectedArrivalDate ?? null,
        notes: order.notes ?? null,
        createdAt: order.createdAt ?? null,
        lines: (order.lines ?? []).map((line) => ({
            sku: lineSku(line),
            quantity: Number(line.expectedQuantity ?? line.quantity ?? 0),
        })),
    };
}
function publicOutboundOrder(order) {
    return {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        externalOrderId: order.externalReference ?? null,
        clientReference: order.clientReference ?? null,
        destinationAddress: order.destinationAddress ?? null,
        requiredShipDate: order.requiredShipDate ?? null,
        notes: order.notes ?? null,
        createdAt: order.createdAt ?? null,
        lines: (order.lines ?? []).map((line) => ({
            sku: lineSku(line),
            quantity: Number(line.requestedQuantity ?? line.quantity ?? 0),
        })),
    };
}
//# sourceMappingURL=public-order.serialize.js.map