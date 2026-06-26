"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.productRealtimePayload = productRealtimePayload;
exports.userRealtimePayload = userRealtimePayload;
exports.warehouseRealtimePayload = warehouseRealtimePayload;
exports.locationRealtimePayload = locationRealtimePayload;
function productRealtimePayload(product) {
    return {
        id: product.id,
        companyId: product.companyId,
        name: product.name,
        sku: product.sku,
        barcode: product.barcode,
        description: product.description,
        trackingType: product.trackingType,
        uom: product.uom,
        expiryTracking: product.expiryTracking,
        minStockThreshold: Number(product.minStockThreshold ?? 0),
        status: product.status,
        createdAt: product.createdAt.toISOString(),
        company: product.company ?? undefined,
    };
}
function userRealtimePayload(row) {
    return row;
}
function warehouseRealtimePayload(wh) {
    return {
        id: wh.id,
        name: wh.name,
        code: wh.code,
        address: wh.address,
        city: wh.city,
        country: wh.country,
        status: wh.status,
        createdAt: wh.createdAt.toISOString(),
    };
}
function locationRealtimePayload(loc) {
    return {
        id: loc.id,
        warehouseId: loc.warehouseId,
        parentId: loc.parentId,
        name: loc.name,
        fullPath: loc.fullPath,
        type: loc.type,
        barcode: loc.barcode,
        status: loc.status,
        maxWeightKg: loc.maxWeightKg != null ? String(loc.maxWeightKg) : null,
        maxCbm: loc.maxCbm != null ? String(loc.maxCbm) : null,
    };
}
//# sourceMappingURL=realtime-master-data.payload.js.map