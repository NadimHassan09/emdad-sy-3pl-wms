"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseActualQuantity = parseActualQuantity;
exports.validateActualQuantityForProduct = validateActualQuantityForProduct;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const discrete_uom_quantity_1 = require("../../common/utils/discrete-uom-quantity");
const MAX_QTY = new client_1.Prisma.Decimal('999999999.9999');
function parseActualQuantity(raw) {
    const trimmed = raw?.trim();
    if (!trimmed) {
        throw new common_1.BadRequestException('actualQuantity is required.');
    }
    let actual;
    try {
        actual = new client_1.Prisma.Decimal(trimmed);
    }
    catch {
        throw new common_1.BadRequestException('actualQuantity must be a valid number.');
    }
    if (!actual.isFinite()) {
        throw new common_1.BadRequestException('actualQuantity must be a finite number.');
    }
    if (actual.lessThan(0)) {
        throw new common_1.BadRequestException('actualQuantity cannot be negative.');
    }
    if (actual.greaterThan(MAX_QTY)) {
        throw new common_1.BadRequestException('actualQuantity exceeds the allowed maximum.');
    }
    return actual;
}
function validateActualQuantityForProduct(uom, actual) {
    (0, discrete_uom_quantity_1.assertDiscreteUomNonNegativeIntegerDecimal)(uom, actual, 'Counted quantity');
}
//# sourceMappingURL=cycle-count-count-validation.util.js.map