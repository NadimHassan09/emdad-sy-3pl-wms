"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.serializeOmsOrderLine = serializeOmsOrderLine;
exports.serializeOmsOrderListItem = serializeOmsOrderListItem;
exports.serializeOmsOrder = serializeOmsOrder;
exports.composeDestinationAddress = composeDestinationAddress;
exports.deriveCodStatus = deriveCodStatus;
exports.mapOutboundStatusToOms = mapOutboundStatusToOms;
exports.omsEventTypeForStatus = omsEventTypeForStatus;
const shipping_carrier_resolver_1 = require("../shipping/shipping-carrier-resolver");
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
    const carrierName = (0, shipping_carrier_resolver_1.resolveShippingCarrierName)(order);
    const explicitMethod = order.shippingMethod ?? order.outboundOrder?.shippingMethod ?? null;
    const resolvedMethod = explicitMethod ?? (carrierName ? 'carrier' : null);
    const isManual = resolvedMethod === 'manual';
    return {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        carrier: carrierName,
        shippingCarrierName: carrierName,
        shippingMethod: resolvedMethod,
        isManualShipping: isManual,
        companyId: order.companyId,
        company: order.company ?? null,
        recipientName: order.recipientName,
        recipientPhone: order.recipientPhone,
        city: order.city,
        storeChannel: order.storeChannel,
        total: computeTotal(order),
        currency: order.currency,
        outboundOrderId: order.outboundOrderId,
        trackingNumber: order.trackingNumber ??
            order.outboundOrder?.trackingNumber ??
            order.outboundOrder?.carrierShipments?.[0]?.externalAwb ??
            null,
        needsInformation: order.needsInformation,
        importBatchId: order.importBatchId ?? null,
        externalReference: order.externalReference ?? null,
        clientReference: order.clientReference ?? null,
        linkedOutboundOrder: order.outboundOrder
            ? {
                id: order.outboundOrder.id,
                orderNumber: order.outboundOrder.orderNumber,
                status: order.outboundOrder.status,
                trackingNumber: order.outboundOrder.trackingNumber ?? order.trackingNumber ?? null,
                hasCarrierShipment: order.outboundOrder.carrierShipments?.some((s) => s.status === 'created' || Boolean(s.externalAwb)) ?? Boolean(order.outboundOrder.trackingNumber || order.trackingNumber),
            }
            : null,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
    };
}
function serializeOmsOrder(order) {
    const subtotal = computeSubtotal(order);
    const carrierName = (0, shipping_carrier_resolver_1.resolveShippingCarrierName)(order);
    const returnsList = order.omsReturns ?? order.returns ?? [];
    const activeReturn = returnsList.find((r) => r.status === 'requested' || r.status === 'approved' || r.status === 'completed');
    return {
        ...order,
        deliveryFailedAt: order.deliveryFailedAt ?? null,
        activeReturn: activeReturn
            ? {
                id: activeReturn.id,
                returnNumber: activeReturn.returnNumber,
                status: activeReturn.status,
                reason: activeReturn.reason,
                carrierReturnStage: activeReturn.carrierReturnStage,
                carrierOriginalStatus: activeReturn.carrierOriginalStatus,
                carrierAwb: activeReturn.carrierAwb,
                carrierReturnCreatedAt: activeReturn.carrierReturnCreatedAt,
                carrierReturningAt: activeReturn.carrierReturningAt,
                carrierReturnedAt: activeReturn.carrierReturnedAt,
                warehouseConfirmedAt: activeReturn.warehouseConfirmedAt,
                createdAt: activeReturn.createdAt,
            }
            : null,
        carrier: carrierName ?? ((0, shipping_carrier_resolver_1.isProviderName)(order.carrier) ? null : order.carrier),
        shippingCarrierName: carrierName,
        destinationAddress: buildLegacyDestination(order),
        subtotal,
        shippingFee: dec(order.shippingFee),
        codAmount: dec(order.codAmount),
        shippingReceiverLat: dec(order.shippingReceiverLat),
        shippingReceiverLng: dec(order.shippingReceiverLng),
        babelNeighbourhoodId: order.babelNeighbourhoodId ?? null,
        shippingWeightKg: dec(order.shippingWeightKg),
        total: computeTotal(order),
        linkedOutboundOrder: order.outboundOrder
            ? {
                id: order.outboundOrder.id,
                orderNumber: order.outboundOrder.orderNumber,
                status: order.outboundOrder.status,
                trackingNumber: order.outboundOrder.trackingNumber ?? order.trackingNumber ?? null,
                hasCarrierShipment: order.outboundOrder.carrierShipments?.some((s) => s.status === 'created' || Boolean(s.externalAwb)) ?? Boolean(order.outboundOrder.trackingNumber || order.trackingNumber),
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
        case 'draft':
        case 'pending_approval':
        case 'pending_stock':
        case 'confirmed':
        case 'allocated':
        case 'picking':
        case 'packing':
        case 'waiting_for_shipping_method':
        case 'waiting_for_shipping_details':
            return 'processing';
        case 'ready_to_ship':
            return 'ready_to_ship';
        case 'shipped':
        case 'out_for_delivery':
            return 'shipped';
        case 'delivered':
            return null;
        case 'externally_fulfilled':
            return null;
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