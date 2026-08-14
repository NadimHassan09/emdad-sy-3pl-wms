"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isEligibleForBulkShipping = isEligibleForBulkShipping;
exports.recommendCheapestProvider = recommendCheapestProvider;
exports.resolveBulkProviderSelection = resolveBulkProviderSelection;
const client_1 = require("@prisma/client");
const shipping_constants_1 = require("./shipping.constants");
function isEligibleForBulkShipping(order) {
    if (order.status !== client_1.OutboundOrderStatus.ready_to_ship && order.status !== 'ready_to_ship') {
        return false;
    }
    if (order.trackingNumber?.trim()) {
        return false;
    }
    const hasCreated = (order.carrierShipments ?? []).some((s) => s.status === client_1.CarrierShipmentStatus.created || s.status === 'created');
    return !hasCreated;
}
function recommendCheapestProvider(quotes) {
    const valid = quotes.filter((q) => q.providerCode &&
        q.providerCode !== shipping_constants_1.MANUAL_SHIPPING_CODE &&
        Number.isFinite(q.price) &&
        q.price >= 0);
    if (valid.length === 0)
        return null;
    return valid.reduce((best, cur) => (cur.price < best.price ? cur : best));
}
function resolveBulkProviderSelection(params) {
    if (params.overrideCode?.trim()) {
        return params.overrideCode.trim().toUpperCase();
    }
    if (params.recommendedCode?.trim()) {
        return params.recommendedCode.trim().toUpperCase();
    }
    if (params.currentMethod === 'carrier' && params.currentProviderCode?.trim()) {
        return params.currentProviderCode.trim().toUpperCase();
    }
    return shipping_constants_1.MANUAL_SHIPPING_CODE;
}
//# sourceMappingURL=bulk-shipping.eligibility.js.map