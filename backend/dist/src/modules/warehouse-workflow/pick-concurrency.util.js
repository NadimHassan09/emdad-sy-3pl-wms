"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stockTupleLockKey = stockTupleLockKey;
exports.compareStockTupleLockKeys = compareStockTupleLockKeys;
exports.sortReservationSnapshotsForLocking = sortReservationSnapshotsForLocking;
exports.sortPickLinesForLocking = sortPickLinesForLocking;
function stockTupleLockKey(parts) {
    const lot = parts.lotId ?? '';
    return `${parts.companyId}\0${parts.productId}\0${parts.locationId}\0${lot}`;
}
function compareStockTupleLockKeys(a, b) {
    return a.localeCompare(b);
}
function sortReservationSnapshotsForLocking(rows) {
    return [...rows].sort((a, b) => compareStockTupleLockKeys(stockTupleLockKey({
        companyId: a.companyId,
        productId: a.productId,
        locationId: a.locationId,
        lotId: a.lotId,
    }), stockTupleLockKey({
        companyId: b.companyId,
        productId: b.productId,
        locationId: b.locationId,
        lotId: b.lotId,
    })));
}
function sortPickLinesForLocking(lines) {
    return [...lines].sort((a, b) => {
        const byProduct = a.productId.localeCompare(b.productId);
        if (byProduct !== 0)
            return byProduct;
        return a.outboundOrderLineId.localeCompare(b.outboundOrderLineId);
    });
}
//# sourceMappingURL=pick-concurrency.util.js.map