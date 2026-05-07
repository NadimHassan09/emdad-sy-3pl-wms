"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NON_STORAGE_LOCATION_TYPES = void 0;
exports.isStorageLocationType = isStorageLocationType;
exports.isQuarantineStorageLocationType = isQuarantineStorageLocationType;
exports.isAdjustmentStockLocationType = isAdjustmentStockLocationType;
exports.NON_STORAGE_LOCATION_TYPES = [
    'warehouse',
    'view',
    'input',
    'output',
    'scrap',
    'transit',
    'iss',
];
function isStorageLocationType(type) {
    if (!type)
        return false;
    if (type === 'qc')
        return false;
    return !exports.NON_STORAGE_LOCATION_TYPES.includes(type);
}
function isQuarantineStorageLocationType(type) {
    return type === 'quarantine' || type === 'scrap';
}
const ADJUSTMENT_STOCK_LOCATION_TYPES = new Set(['internal', 'fridge', 'quarantine', 'scrap']);
function isAdjustmentStockLocationType(type) {
    return !!type && ADJUSTMENT_STOCK_LOCATION_TYPES.has(type);
}
//# sourceMappingURL=storage-location-types.js.map