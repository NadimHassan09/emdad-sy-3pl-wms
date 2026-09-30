"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.annotateRateQuotes = annotateRateQuotes;
const bulk_shipping_eligibility_1 = require("./bulk-shipping.eligibility");
function annotateRateQuotes(quotes) {
    const priced = quotes.filter((q) => q.available && Number.isFinite(q.price));
    const minNormPrice = priced.length
        ? Math.min(...priced.map((q) => (0, bulk_shipping_eligibility_1.normalizePriceForComparison)(q.price, q.currency)))
        : null;
    const withEta = quotes.filter((q) => q.available &&
        q.estimatedDeliveryMax != null &&
        Number.isFinite(q.estimatedDeliveryMax));
    const minEta = withEta.length
        ? Math.min(...withEta.map((q) => q.estimatedDeliveryMax))
        : null;
    const annotated = quotes.map((q) => {
        const norm = (0, bulk_shipping_eligibility_1.normalizePriceForComparison)(q.price, q.currency);
        const isCheapest = minNormPrice != null && q.available && Math.abs(norm - minNormPrice) < 1e-6;
        const isFastest = minEta != null && q.available && q.estimatedDeliveryMax === minEta;
        return {
            ...q,
            isCheapest,
            isFastest,
            isRecommended: isCheapest,
        };
    });
    return [...annotated].sort((a, b) => {
        const pA = Number.isFinite(a.price) ? (0, bulk_shipping_eligibility_1.normalizePriceForComparison)(a.price, a.currency) : 999999;
        const pB = Number.isFinite(b.price) ? (0, bulk_shipping_eligibility_1.normalizePriceForComparison)(b.price, b.currency) : 999999;
        return pA - pB;
    });
}
//# sourceMappingURL=shipping-rate.util.js.map