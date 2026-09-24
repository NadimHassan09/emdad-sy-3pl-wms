"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EXPORT_PRODUCT_SELECT = void 0;
exports.exportProductNames = exportProductNames;
exports.exportProductWeights = exportProductWeights;
exports.EXPORT_PRODUCT_SELECT = { name: true, weightKg: true };
function asLines(lines) {
    if (!Array.isArray(lines))
        return [];
    return lines;
}
function productName(line) {
    return String(line.product?.name ?? '').trim();
}
function productWeight(line) {
    const w = line.product?.weightKg;
    if (w == null || w === '')
        return '';
    return String(w);
}
function exportProductNames(lines) {
    const items = asLines(lines);
    if (items.every((l) => !productName(l)))
        return '';
    return items.map(productName).join(' | ');
}
function exportProductWeights(lines) {
    const items = asLines(lines);
    if (items.every((l) => !productWeight(l)))
        return '';
    return items.map(productWeight).join(' | ');
}
//# sourceMappingURL=order-export-product-cells.js.map