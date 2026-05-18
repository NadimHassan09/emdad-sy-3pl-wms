"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isDiscreteProductUom = isDiscreteProductUom;
exports.assertDiscreteUomPositiveIntegerQuantity = assertDiscreteUomPositiveIntegerQuantity;
exports.assertDiscreteUomPositiveIntegerDecimal = assertDiscreteUomPositiveIntegerDecimal;
exports.assertDiscreteUomNonNegativeIntegerDecimal = assertDiscreteUomNonNegativeIntegerDecimal;
const common_1 = require("@nestjs/common");
const DISCRETE_PRODUCT_UOMS = new Set([
    'piece',
    'box',
    'roll',
    'pallet',
    'carton',
]);
function isDiscreteProductUom(uom) {
    return DISCRETE_PRODUCT_UOMS.has(uom);
}
function assertDiscreteUomPositiveIntegerQuantity(uom, quantity, fieldLabel) {
    if (!isDiscreteProductUom(uom))
        return;
    if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new common_1.BadRequestException(`${fieldLabel} must be a positive number for products with UOM "${uom}".`);
    }
    if (!Number.isInteger(quantity)) {
        throw new common_1.BadRequestException(`${fieldLabel} must be a whole number (decimals are not allowed) for UOM "${uom}".`);
    }
}
function assertDiscreteUomPositiveIntegerDecimal(uom, quantity, fieldLabel) {
    if (!isDiscreteProductUom(uom))
        return;
    if (quantity.lessThanOrEqualTo(0)) {
        throw new common_1.BadRequestException(`${fieldLabel} must be greater than zero for products with UOM "${uom}".`);
    }
    if (!quantity.modulo(1).equals(0)) {
        throw new common_1.BadRequestException(`${fieldLabel} must be a whole number (decimals are not allowed) for UOM "${uom}".`);
    }
}
function assertDiscreteUomNonNegativeIntegerDecimal(uom, quantity, fieldLabel) {
    if (!isDiscreteProductUom(uom))
        return;
    if (quantity.lessThan(0)) {
        throw new common_1.BadRequestException(`${fieldLabel} cannot be negative for products with UOM "${uom}".`);
    }
    if (!quantity.modulo(1).equals(0)) {
        throw new common_1.BadRequestException(`${fieldLabel} must be a whole number (decimals are not allowed) for UOM "${uom}".`);
    }
}
//# sourceMappingURL=discrete-uom-quantity.js.map