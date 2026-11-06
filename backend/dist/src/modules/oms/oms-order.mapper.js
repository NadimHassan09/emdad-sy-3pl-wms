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
const shipping_lifecycle_util_1 = require("../shipping/shipping-lifecycle.util");
const shipping_lookup_util_1 = require("../shipping/shipping-lookup.util");
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
function liveShipmentTracking(order) {
    const active = (0, shipping_lifecycle_util_1.pickActiveCarrierShipment)(order.outboundOrder?.carrierShipments ?? []);
    if (active && (0, shipping_lifecycle_util_1.isAwbPendingReassignment)(active.rawResultMeta))
        return null;
    if (active) {
        return active.trackingNumber?.trim() || null;
    }
    return (order.trackingNumber?.trim() ||
        order.outboundOrder?.trackingNumber?.trim() ||
        null);
}
function liveAwbPending(order) {
    const active = (0, shipping_lifecycle_util_1.pickActiveCarrierShipment)(order.outboundOrder?.carrierShipments ?? []);
    if (!active)
        return false;
    if ((0, shipping_lifecycle_util_1.isAwbPendingReassignment)(active.rawResultMeta))
        return true;
    return !active.trackingNumber?.trim();
}
function serializeOmsOrderListItem(order) {
    const carrierName = (0, shipping_carrier_resolver_1.resolveShippingCarrierName)(order);
    const explicitMethod = order.shippingMethod ?? order.outboundOrder?.shippingMethod ?? null;
    const resolvedMethod = explicitMethod ?? (carrierName ? 'carrier' : null);
    const isManual = resolvedMethod === 'manual';
    const activeShipment = (0, shipping_lifecycle_util_1.pickActiveCarrierShipment)(order.outboundOrder?.carrierShipments ?? []);
    const liveTracking = liveShipmentTracking(order);
    const awbPending = liveAwbPending(order);
    return {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        carrier: carrierName,
        shippingCarrierName: carrierName,
        awbPending,
        cancellationUnconfirmed: (0, shipping_lookup_util_1.isCancellationUnconfirmed)(activeShipment?.rawResultMeta),
        shippingHubId: order.outboundOrder?.shippingHubId ?? null,
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
        shippingFee: dec(order.shippingFee),
        outboundOrderId: order.outboundOrderId,
        trackingNumber: liveTracking,
        needsInformation: order.needsInformation,
        importBatchId: order.importBatchId ?? null,
        externalReference: order.externalReference ?? null,
        clientReference: order.clientReference ?? null,
        contents: (order.lines ?? []).map((l) => ({
            sku: l.product?.sku ?? null,
            name: l.product?.name ?? null,
            quantity: dec(l.requestedQuantity),
        })),
        lastCarrierEvent: (() => {
            const ev = activeShipment?.events?.[0];
            if (!ev)
                return null;
            return {
                text: ev.eventDescription || ev.originalCarrierStatus || ev.normalizedStatus || null,
                at: ev.eventTimestamp ?? null,
                location: ev.locationText ?? null,
            };
        })(),
        linkedOutboundOrder: order.outboundOrder
            ? {
                id: order.outboundOrder.id,
                orderNumber: order.outboundOrder.orderNumber,
                status: order.outboundOrder.status,
                trackingNumber: liveTracking,
                hasCarrierShipment: Boolean(activeShipment),
                shippingMethod: order.outboundOrder.shippingMethod ?? null,
                shippingProviderCode: order.outboundOrder.shippingProviderCode ?? null,
                shippingServiceId: order.outboundOrder.shippingServiceId ?? null,
                shippingHubId: order.outboundOrder.shippingHubId ?? null,
                shippingQuotedPrice: dec(order.outboundOrder.shippingQuotedPrice),
                shippingQuotedCurrency: order.outboundOrder.shippingQuotedCurrency ?? null,
                shippingCost: dec(order.outboundOrder.carrierShipments?.find((s) => s.status === 'created')?.shippingCost),
                shippingCostCurrency: order.outboundOrder.carrierShipments?.find((s) => s.status === 'created')?.currency ?? null,
            }
            : null,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
    };
}
function serializeOmsOrder(order) {
    const subtotal = computeSubtotal(order);
    const carrierName = (0, shipping_carrier_resolver_1.resolveShippingCarrierName)(order);
    const activeShipment = (0, shipping_lifecycle_util_1.pickActiveCarrierShipment)(order.outboundOrder?.carrierShipments ?? []);
    const liveTracking = liveShipmentTracking(order);
    const returnsList = order.omsReturns ?? order.returns ?? [];
    const activeReturn = returnsList.find((r) => r.status === 'requested' || r.status === 'approved');
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
        awbPending: liveAwbPending(order),
        cancellationUnconfirmed: (0, shipping_lookup_util_1.isCancellationUnconfirmed)(activeShipment?.rawResultMeta),
        shippingHubId: order.outboundOrder?.shippingHubId ?? null,
        trackingNumber: liveTracking,
        destinationAddress: buildLegacyDestination(order),
        subtotal,
        shippingFee: dec(order.shippingFee),
        clientShippingRateAppliedAt: order.clientShippingRateAppliedAt ?? null,
        clientShippingRateWeightKg: dec(order.clientShippingRateWeightKg),
        clientShippingRateBreakdown: order.clientShippingRateBreakdown ?? null,
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
                trackingNumber: liveTracking,
                hasCarrierShipment: Boolean(activeShipment),
                shippingMethod: order.outboundOrder.shippingMethod ?? null,
                shippingProviderCode: order.outboundOrder.shippingProviderCode ?? null,
                shippingServiceId: order.outboundOrder.shippingServiceId ?? null,
                shippingHubId: order.outboundOrder.shippingHubId ?? null,
                shippingQuotedPrice: dec(order.outboundOrder.shippingQuotedPrice),
                shippingQuotedCurrency: order.outboundOrder.shippingQuotedCurrency ?? null,
                shippingCost: dec(order.outboundOrder.carrierShipments?.find((s) => s.status === 'created')?.shippingCost),
                shippingCostCurrency: order.outboundOrder.carrierShipments?.find((s) => s.status === 'created')?.currency ?? null,
            }
            : null,
        warehouseStatus: order.outboundOrder?.status ?? null,
        lines: order.lines.map(serializeOmsOrderLine),
    };
}
function composeDestinationAddress(input) {
    const parts = [input.addressLine1, input.district, input.city, input.addressLine2].filter((p) => p?.trim());
    if (parts.length > 0) {
        const joined = parts.join(', ');
        if (input.destinationAddress?.trim()) {
            const dest = input.destinationAddress.trim();
            if (dest.length > 10 && dest.toLowerCase() !== input.city?.trim().toLowerCase()) {
                return dest;
            }
        }
        return joined;
    }
    if (input.destinationAddress?.trim())
        return input.destinationAddress.trim();
    return '';
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
            return 'processing';
        case 'waiting_for_shipping_method':
        case 'waiting_for_shipping_details':
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