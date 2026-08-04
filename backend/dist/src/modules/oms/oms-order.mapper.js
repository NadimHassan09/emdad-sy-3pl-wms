"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.serializeOmsOrderLine = serializeOmsOrderLine;
exports.serializeOmsOrderListItem = serializeOmsOrderListItem;
exports.serializeOmsOrder = serializeOmsOrder;
exports.composeDestinationAddress = composeDestinationAddress;
exports.deriveCodStatus = deriveCodStatus;
exports.mapOutboundStatusToOms = mapOutboundStatusToOms;
exports.omsEventTypeForStatus = omsEventTypeForStatus;
function dec(v) {
    if (v == null)
        return null;
    return v.toString();
}
function buildLegacyDestination(order) {
    const parts = [
        order.addressLine1,
        order.district,
        order.city,
        order.addressLine2,
    ].filter(Boolean);
    if (parts.length > 0)
        return parts.join(', ');
    return order.destinationAddress;
}
function linesSum(order) {
    return (order.lines ?? []).reduce((sum, line) => {
        if (line.lineTotal != null)
            return sum + Number(line.lineTotal);
        if (line.unitPrice != null) {
            return sum + Number(line.unitPrice) * Number(line.requestedQuantity);
        }
        return sum;
    }, 0);
}
function computeSubtotal(order) {
    const ship = order.shippingFee != null ? Number(order.shippingFee) : 0;
    if ((order.lines?.length ?? 0) > 0) {
        return String(linesSum(order) + ship);
    }
    if (order.subtotal != null)
        return order.subtotal.toString();
    if (order.shippingFee != null)
        return String(ship);
    return null;
}
function computeTotal(order) {
    return computeSubtotal(order);
}
function serializeOmsOrderLine(line) {
    return {
        ...line,
        requestedQuantity: line.requestedQuantity.toString(),
        unitPrice: dec(line.unitPrice),
        lineTotal: dec(line.lineTotal),
        discountAmount: dec(line.discountAmount),
    };
}
function serializeOmsOrderListItem(order) {
    return {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        companyId: order.companyId,
        company: order.company ?? null,
        recipientName: order.recipientName,
        storeChannel: order.storeChannel,
        total: computeTotal(order),
        currency: order.currency,
        outboundOrderId: order.outboundOrderId,
        linkedOutboundOrder: order.outboundOrder
            ? {
                id: order.outboundOrder.id,
                orderNumber: order.outboundOrder.orderNumber,
                status: order.outboundOrder.status,
            }
            : null,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
    };
}
function serializeOmsOrder(order) {
    const subtotal = computeSubtotal(order);
    return {
        ...order,
        destinationAddress: buildLegacyDestination(order),
        subtotal,
        shippingFee: dec(order.shippingFee),
        codAmount: dec(order.codAmount),
        total: computeTotal(order),
        linkedOutboundOrder: order.outboundOrder
            ? {
                id: order.outboundOrder.id,
                orderNumber: order.outboundOrder.orderNumber,
                status: order.outboundOrder.status,
            }
            : null,
        warehouseStatus: order.outboundOrder?.status ?? null,
        lines: order.lines.map(serializeOmsOrderLine),
    };
}
function composeDestinationAddress(input) {
    if (input.destinationAddress?.trim())
        return input.destinationAddress.trim();
    const parts = [input.addressLine1, input.district, input.city, input.addressLine2].filter((p) => p?.trim());
    if (parts.length === 0)
        return '';
    return parts.join(', ');
}
function deriveCodStatus(paymentMethod, codAmount) {
    if (paymentMethod === 'COD' && codAmount && !codAmount.isZero()) {
        return 'pending';
    }
    return null;
}
function mapOutboundStatusToOms(status) {
    switch (status) {
        case 'shipped':
        case 'out_for_delivery':
        case 'delivered':
            return 'out_for_delivery';
        case 'cancelled':
            return 'cancelled';
        default:
            return null;
    }
}
function omsEventTypeForStatus(status) {
    return `order.${status}`;
}
//# sourceMappingURL=oms-order.mapper.js.map