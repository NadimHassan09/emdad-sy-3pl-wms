"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BARCODE_BLOCKING_STATUSES = void 0;
exports.normalizeProductBarcode = normalizeProductBarcode;
exports.barcodeChanged = barcodeChanged;
exports.assertCompanyBarcodeAvailable = assertCompanyBarcodeAvailable;
const common_1 = require("@nestjs/common");
exports.BARCODE_BLOCKING_STATUSES = ['active', 'suspended'];
function normalizeProductBarcode(raw) {
    if (raw == null)
        return null;
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
}
function barcodeChanged(current, next) {
    return normalizeProductBarcode(current) !== next;
}
async function assertCompanyBarcodeAvailable(db, companyId, barcode, excludeProductId) {
    const normalized = normalizeProductBarcode(barcode);
    if (!normalized)
        return;
    const where = {
        companyId,
        barcode: normalized,
        status: { in: exports.BARCODE_BLOCKING_STATUSES },
    };
    if (excludeProductId) {
        where.NOT = { id: excludeProductId };
    }
    const existing = await db.product.findFirst({
        where,
        select: { id: true },
    });
    if (existing) {
        throw new common_1.ConflictException('Barcode already in use for an active product in this company.');
    }
}
//# sourceMappingURL=product-barcode.util.js.map