"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OUTBOUND_POST_CONFIRM = exports.OUTBOUND_CONFIRMABLE = void 0;
exports.isOutboundConfirmable = isOutboundConfirmable;
exports.isOutboundPostConfirm = isOutboundPostConfirm;
exports.lockOutboundOrderRow = lockOutboundOrderRow;
exports.claimOutboundConfirmableOrder = claimOutboundConfirmableOrder;
exports.finalizeOutboundShipped = finalizeOutboundShipped;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
exports.OUTBOUND_CONFIRMABLE = [
    client_1.OutboundOrderStatus.draft,
    client_1.OutboundOrderStatus.pending_approval,
];
exports.OUTBOUND_POST_CONFIRM = [
    client_1.OutboundOrderStatus.confirmed,
    client_1.OutboundOrderStatus.picking,
    client_1.OutboundOrderStatus.packing,
    client_1.OutboundOrderStatus.ready_to_ship,
    client_1.OutboundOrderStatus.shipped,
];
function isOutboundConfirmable(status) {
    return exports.OUTBOUND_CONFIRMABLE.includes(status);
}
function isOutboundPostConfirm(status) {
    return exports.OUTBOUND_POST_CONFIRM.includes(status);
}
async function lockOutboundOrderRow(tx, orderId) {
    const rows = await tx.$queryRaw(client_1.Prisma.sql `SELECT id FROM outbound_orders WHERE id = ${orderId}::uuid FOR UPDATE`);
    if (rows.length === 0) {
        throw new common_1.NotFoundException('Outbound order not found.');
    }
}
async function claimOutboundConfirmableOrder(tx, orderId, data) {
    const result = await tx.outboundOrder.updateMany({
        where: { id: orderId, status: { in: exports.OUTBOUND_CONFIRMABLE } },
        data,
    });
    return result.count === 1;
}
async function finalizeOutboundShipped(tx, orderId) {
    const result = await tx.outboundOrder.updateMany({
        where: { id: orderId, status: client_1.OutboundOrderStatus.picking },
        data: {
            status: client_1.OutboundOrderStatus.shipped,
            shippedAt: new Date(),
        },
    });
    return result.count === 1;
}
//# sourceMappingURL=outbound-confirm-lock.util.js.map