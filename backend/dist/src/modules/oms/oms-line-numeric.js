"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertOmsLinePositiveWholeQuantity = assertOmsLinePositiveWholeQuantity;
exports.assertOmsLineNonNegativeWholePrice = assertOmsLineNonNegativeWholePrice;
const common_1 = require("@nestjs/common");
function assertOmsLinePositiveWholeQuantity(quantity, fieldLabel = 'Requested quantity') {
    if (!Number.isFinite(quantity) || !Number.isInteger(quantity) || quantity <= 0) {
        throw new common_1.BadRequestException(`${fieldLabel} must be a positive whole number (no decimals, letters, or zero).`);
    }
}
function assertOmsLineNonNegativeWholePrice(unitPrice, fieldLabel = 'Unit price') {
    if (unitPrice == null)
        return;
    if (!Number.isFinite(unitPrice) || !Number.isInteger(unitPrice) || unitPrice < 0) {
        throw new common_1.BadRequestException(`${fieldLabel} must be a whole number (0 or greater; no decimals or letters).`);
    }
}
//# sourceMappingURL=oms-line-numeric.js.map