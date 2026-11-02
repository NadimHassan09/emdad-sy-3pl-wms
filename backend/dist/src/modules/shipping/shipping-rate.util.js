"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.annotateRateQuotes = annotateRateQuotes;
const currency_conversion_1 = require("./currency-conversion");
function annotateRateQuotes(quotes, options = {}) {
    const snapshot = options.snapshot ?? (0, currency_conversion_1.getFxRateSnapshot)();
    const preferred = options.preferredCurrency ?? null;
    const enriched = quotes.map((q) => {
        const cost = (0, currency_conversion_1.effectiveComparableCost)({
            price: q.price,
            currency: q.currency,
            prices: q.prices,
            preferredCurrency: preferred,
        });
        const comparable = (0, currency_conversion_1.comparableValueUsd)({
            price: q.price,
            currency: q.currency,
            prices: q.prices,
            preferredCurrency: preferred,
        }, snapshot);
        return {
            ...q,
            effectiveCostAmount: cost.amount,
            effectiveCostCurrency: cost.currency,
            comparableValueUsd: comparable,
            fxRate: snapshot.usdToSypRate,
            fxSource: snapshot.source,
            fxTimestamp: snapshot.timestamp,
        };
    });
    const priced = enriched.filter((q) => q.available && Number.isFinite(q.comparableValueUsd));
    const minNormPrice = priced.length
        ? Math.min(...priced.map((q) => q.comparableValueUsd))
        : null;
    const withEta = enriched.filter((q) => q.available &&
        q.estimatedDeliveryMax != null &&
        Number.isFinite(q.estimatedDeliveryMax));
    const minEta = withEta.length
        ? Math.min(...withEta.map((q) => q.estimatedDeliveryMax))
        : null;
    const annotated = enriched.map((q) => {
        const isCheapest = minNormPrice != null &&
            q.available &&
            Math.abs(q.comparableValueUsd - minNormPrice) < 1e-6;
        const isFastest = minEta != null && q.available && q.estimatedDeliveryMax === minEta;
        return {
            ...q,
            isCheapest,
            isFastest,
            isRecommended: isCheapest,
        };
    });
    return [...annotated].sort((a, b) => {
        const pA = Number.isFinite(a.comparableValueUsd) ? a.comparableValueUsd : 999999;
        const pB = Number.isFinite(b.comparableValueUsd) ? b.comparableValueUsd : 999999;
        return pA - pB;
    });
}
//# sourceMappingURL=shipping-rate.util.js.map