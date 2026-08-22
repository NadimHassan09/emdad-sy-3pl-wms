"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.annotateRateQuotes = annotateRateQuotes;
function annotateRateQuotes(quotes) {
    const priced = quotes.filter((q) => q.available && Number.isFinite(q.price));
    const minPrice = priced.length ? Math.min(...priced.map((q) => q.price)) : null;
    const withEta = quotes.filter((q) => q.available &&
        q.estimatedDeliveryMax != null &&
        Number.isFinite(q.estimatedDeliveryMax));
    const minEta = withEta.length
        ? Math.min(...withEta.map((q) => q.estimatedDeliveryMax))
        : null;
    return quotes.map((q) => {
        const isCheapest = minPrice != null && q.available && q.price === minPrice;
        const isFastest = minEta != null && q.available && q.estimatedDeliveryMax === minEta;
        return {
            ...q,
            isCheapest,
            isFastest,
            isRecommended: isCheapest,
        };
    });
}
//# sourceMappingURL=shipping-rate.util.js.map