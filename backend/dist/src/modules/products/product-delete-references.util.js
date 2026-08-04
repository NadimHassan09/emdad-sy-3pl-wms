"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OMS_ORDER_STATUSES_REMOVABLE_PRODUCT_LINES = exports.OUTBOUND_ORDER_STATUSES_REMOVABLE_PRODUCT_LINES = exports.INBOUND_ORDER_STATUSES_REMOVABLE_PRODUCT_LINES = exports.OMS_ORDER_STATUSES_BLOCKING_PRODUCT_DELETE = exports.OUTBOUND_ORDER_STATUSES_BLOCKING_PRODUCT_DELETE = exports.INBOUND_ORDER_STATUSES_BLOCKING_PRODUCT_DELETE = void 0;
exports.inboundLinesBlockingProductDeleteWhere = inboundLinesBlockingProductDeleteWhere;
exports.outboundLinesBlockingProductDeleteWhere = outboundLinesBlockingProductDeleteWhere;
exports.omsLinesBlockingProductDeleteWhere = omsLinesBlockingProductDeleteWhere;
exports.purgeRemovableOrderLinesForProduct = purgeRemovableOrderLinesForProduct;
exports.INBOUND_ORDER_STATUSES_BLOCKING_PRODUCT_DELETE = [
    'confirmed',
    'in_progress',
    'partially_received',
    'completed',
];
exports.OUTBOUND_ORDER_STATUSES_BLOCKING_PRODUCT_DELETE = [
    'pending_stock',
    'confirmed',
    'picking',
    'packing',
    'ready_to_ship',
    'shipped',
];
exports.OMS_ORDER_STATUSES_BLOCKING_PRODUCT_DELETE = [
    'approved',
    'confirmed',
    'processing',
    'allocated',
    'picking',
    'packing',
    'ready_to_ship',
    'out_for_delivery',
    'shipped',
    'delivered',
    'failed_delivery',
    'completed',
    'returned',
];
exports.INBOUND_ORDER_STATUSES_REMOVABLE_PRODUCT_LINES = [
    'draft',
    'pending_approval',
    'cancelled',
];
exports.OUTBOUND_ORDER_STATUSES_REMOVABLE_PRODUCT_LINES = [
    'draft',
    'pending_approval',
    'cancelled',
];
exports.OMS_ORDER_STATUSES_REMOVABLE_PRODUCT_LINES = [
    'draft',
    'pending_approval',
    'rejected',
    'cancelled',
];
function productIdFilter(productIds) {
    return Array.isArray(productIds)
        ? productIds.length === 1
            ? productIds[0]
            : { in: productIds }
        : productIds;
}
function inboundLinesBlockingProductDeleteWhere(productIds) {
    return {
        productId: productIdFilter(productIds),
        order: { status: { in: [...exports.INBOUND_ORDER_STATUSES_BLOCKING_PRODUCT_DELETE] } },
    };
}
function outboundLinesBlockingProductDeleteWhere(productIds) {
    return {
        productId: productIdFilter(productIds),
        order: { status: { in: [...exports.OUTBOUND_ORDER_STATUSES_BLOCKING_PRODUCT_DELETE] } },
    };
}
function omsLinesBlockingProductDeleteWhere(productIds) {
    return {
        productId: productIdFilter(productIds),
        order: { status: { in: [...exports.OMS_ORDER_STATUSES_BLOCKING_PRODUCT_DELETE] } },
    };
}
async function purgeRemovableOrderLinesForProduct(tx, productId) {
    await tx.inboundOrderLine.deleteMany({
        where: {
            productId,
            order: { status: { in: [...exports.INBOUND_ORDER_STATUSES_REMOVABLE_PRODUCT_LINES] } },
        },
    });
    await tx.outboundOrderLine.deleteMany({
        where: {
            productId,
            order: { status: { in: [...exports.OUTBOUND_ORDER_STATUSES_REMOVABLE_PRODUCT_LINES] } },
        },
    });
    await tx.omsOrderLine.deleteMany({
        where: {
            productId,
            order: { status: { in: [...exports.OMS_ORDER_STATUSES_REMOVABLE_PRODUCT_LINES] } },
        },
    });
}
//# sourceMappingURL=product-delete-references.util.js.map