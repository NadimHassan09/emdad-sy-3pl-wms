"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aggregateNormalReturnRows = aggregateNormalReturnRows;
exports.looksLikeProductUuid = looksLikeProductUuid;
exports.resolveProductOnOrderLines = resolveProductOnOrderLines;
function aggregateNormalReturnRows(rows) {
    const map = new Map();
    for (const row of rows) {
        const key = `${row.omsOrderId}|${row.productId}`;
        const existing = map.get(key);
        if (!existing) {
            map.set(key, {
                omsOrderId: row.omsOrderId,
                productId: row.productId,
                quantity: row.quantity,
                sourceRows: [row.source],
            });
            continue;
        }
        existing.quantity += row.quantity;
        existing.sourceRows.push(row.source);
    }
    return [...map.values()];
}
function looksLikeProductUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim());
}
function resolveProductOnOrderLines(lines, productReference) {
    const ref = productReference.trim();
    if (!ref)
        return null;
    if (looksLikeProductUuid(ref)) {
        return lines.find((l) => l.productId.toLowerCase() === ref.toLowerCase()) ?? null;
    }
    const skuLower = ref.toLowerCase();
    const matches = lines.filter((l) => (l.product?.sku ?? '').trim().toLowerCase() === skuLower);
    if (matches.length === 1)
        return matches[0];
    return null;
}
//# sourceMappingURL=normal-return-import.js.map