"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OUTBOUND_SHIPPING_DETAILS_SPAWNABLE = exports.OUTBOUND_WAREHOUSE_CLOSED = exports.OMS_BLOCKS_WAREHOUSE_EXECUTION = void 0;
exports.omsBlocksWarehouseExecution = omsBlocksWarehouseExecution;
exports.outboundWarehouseClosed = outboundWarehouseClosed;
exports.outboundAllowsShippingDetailsSpawn = outboundAllowsShippingDetailsSpawn;
const client_1 = require("@prisma/client");
exports.OMS_BLOCKS_WAREHOUSE_EXECUTION = new Set([
    client_1.OmsOrderStatus.shipped,
    client_1.OmsOrderStatus.out_for_delivery,
    client_1.OmsOrderStatus.delivered,
    client_1.OmsOrderStatus.returned,
    client_1.OmsOrderStatus.cancelled,
    client_1.OmsOrderStatus.failed_delivery,
    client_1.OmsOrderStatus.completed,
    client_1.OmsOrderStatus.rejected,
]);
exports.OUTBOUND_WAREHOUSE_CLOSED = new Set([
    client_1.OutboundOrderStatus.externally_fulfilled,
    client_1.OutboundOrderStatus.shipped,
    client_1.OutboundOrderStatus.cancelled,
    client_1.OutboundOrderStatus.delivered,
    client_1.OutboundOrderStatus.returned,
    client_1.OutboundOrderStatus.ready_to_ship,
]);
exports.OUTBOUND_SHIPPING_DETAILS_SPAWNABLE = new Set([
    'picking',
    'packing',
    'waiting_for_shipping_details',
]);
function omsBlocksWarehouseExecution(status) {
    return exports.OMS_BLOCKS_WAREHOUSE_EXECUTION.has(status);
}
function outboundWarehouseClosed(status) {
    return exports.OUTBOUND_WAREHOUSE_CLOSED.has(status);
}
function outboundAllowsShippingDetailsSpawn(status) {
    return exports.OUTBOUND_SHIPPING_DETAILS_SPAWNABLE.has(status);
}
//# sourceMappingURL=oms-warehouse-guards.js.map