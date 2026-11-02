"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_USD_TO_SYP_RATE = void 0;
exports.isEligibleForBulkShipping = isEligibleForBulkShipping;
exports.getUsdToSypRate = getUsdToSypRate;
exports.normalizePriceForComparison = normalizePriceForComparison;
exports.recommendCheapestProvider = recommendCheapestProvider;
exports.resolveBulkProviderSelection = resolveBulkProviderSelection;
const client_1 = require("@prisma/client");
const currency_conversion_1 = require("./currency-conversion");
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
exports.DEFAULT_USD_TO_SYP_RATE = 14500;
function getUsdToSypRate() {
    return (0, currency_conversion_1.getFxRateSnapshot)().usdToSypRate;
}
function normalizePriceForComparison(price, currency, snapshot = (0, currency_conversion_1.getFxRateSnapshot)()) {
    return (0, currency_conversion_1.toComparableUsd)(price, currency, snapshot);
}
function recommendCheapestProvider(quotes, snapshot = (0, currency_conversion_1.getFxRateSnapshot)()) {
    const valid = quotes.filter((q) => q.providerCode &&
        q.providerCode !== shipping_constants_1.MANUAL_SHIPPING_CODE &&
        Number.isFinite(q.price) &&
        q.price >= 0);
    if (valid.length === 0)
        return null;
    return valid.reduce((best, cur) => {
        const bestNorm = (0, currency_conversion_1.comparableValueUsd)(best, snapshot);
        const curNorm = (0, currency_conversion_1.comparableValueUsd)(cur, snapshot);
        return curNorm < bestNorm ? cur : best;
    });
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