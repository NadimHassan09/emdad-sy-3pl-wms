"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.productAuditSnapshot = productAuditSnapshot;
function productAuditSnapshot(row) {
    return {
        id: row.id,
        companyId: row.companyId,
        sku: row.sku,
        name: row.name,
        barcode: row.barcode,
        status: row.status,
        uom: row.uom,
        expiryTracking: row.expiryTracking,
        minStockThreshold: row.minStockThreshold,
    };
}
//# sourceMappingURL=product-audit.util.js.map