"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isBabelAddressDeliveryAvailable = isBabelAddressDeliveryAvailable;
exports.isBabelCalculatePriceShippable = isBabelCalculatePriceShippable;
function isBabelAddressDeliveryAvailable(details) {
    if (!details || typeof details !== 'object')
        return true;
    const record = details;
    const dropoff = record.dropoff ?? record.dropOff;
    return dropoff !== null && dropoff !== undefined;
}
function readFee(details, key) {
    if (!details || typeof details !== 'object')
        return null;
    const raw = details[key];
    if (typeof raw === 'number' && Number.isFinite(raw))
        return raw;
    if (typeof raw === 'string' && raw.trim() !== '') {
        const n = Number(raw);
        return Number.isFinite(n) ? n : null;
    }
    return null;
}
function isBabelCalculatePriceShippable(raw, deliveryType) {
    if (!raw || raw.status === 'error')
        return false;
    const price = typeof raw.price === 'number' ? raw.price : Number(raw.price);
    if (!Number.isFinite(price))
        return false;
    if (deliveryType === 'address' && !isBabelAddressDeliveryAvailable(raw.details)) {
        return false;
    }
    const shipping = readFee(raw.details, 'shipping');
    if (shipping === 0 && price === 0) {
        return false;
    }
    return true;
}
//# sourceMappingURL=babel-quote.util.js.map