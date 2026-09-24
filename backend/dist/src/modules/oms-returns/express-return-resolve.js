"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.looksLikeUuid = looksLikeUuid;
exports.assertOmsOrderUuid = assertOmsOrderUuid;
exports.resolveExpressReturnOrder = resolveExpressReturnOrder;
exports.expressReturnStatusRejectReason = expressReturnStatusRejectReason;
exports.dedupeExpressReturnInputs = dedupeExpressReturnInputs;
const client_1 = require("@prisma/client");
function looksLikeUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim());
}
function assertOmsOrderUuid(omsOrderId) {
    if (!looksLikeUuid(omsOrderId)) {
        throw new Error(`omsOrderId must be a resolved UUID before OMS-return queries (got "${omsOrderId}").`);
    }
}
async function resolveExpressReturnOrder(prisma, rawInput, include) {
    const input = rawInput.trim();
    if (!input) {
        return { ok: false, error: 'Order not found.' };
    }
    if (looksLikeUuid(input)) {
        const order = await prisma.omsOrder.findUnique({
            where: { id: input },
            ...(include ? { include } : {}),
        });
        if (!order)
            return { ok: false, error: 'Order not found.' };
        return { ok: true, order, matchedBy: 'id' };
    }
    const byNumber = await prisma.omsOrder.findMany({
        where: { orderNumber: { equals: input, mode: 'insensitive' } },
        ...(include ? { include } : {}),
        take: 2,
    });
    if (byNumber.length === 1) {
        return { ok: true, order: byNumber[0], matchedBy: 'orderNumber' };
    }
    if (byNumber.length > 1) {
        return {
            ok: false,
            error: 'Ambiguous order number; multiple OMS orders match.',
        };
    }
    const byClientRef = await prisma.omsOrder.findMany({
        where: { clientReference: { equals: input, mode: 'insensitive' } },
        ...(include ? { include } : {}),
        take: 2,
    });
    if (byClientRef.length === 1) {
        return { ok: true, order: byClientRef[0], matchedBy: 'clientReference' };
    }
    if (byClientRef.length > 1) {
        return {
            ok: false,
            error: 'Ambiguous client reference; multiple OMS orders match.',
        };
    }
    return { ok: false, error: 'Order not found.' };
}
const IN_PROGRESS_STATUSES = new Set([
    client_1.OmsOrderStatus.processing,
    client_1.OmsOrderStatus.pending,
    client_1.OmsOrderStatus.pending_approval,
    client_1.OmsOrderStatus.waiting_for_confirmation,
    client_1.OmsOrderStatus.confirmed_waiting_for_admin_approval,
    client_1.OmsOrderStatus.approved,
    client_1.OmsOrderStatus.confirmed,
    client_1.OmsOrderStatus.allocated,
    client_1.OmsOrderStatus.picking,
    client_1.OmsOrderStatus.packing,
    client_1.OmsOrderStatus.ready_to_ship,
    client_1.OmsOrderStatus.draft,
]);
function expressReturnStatusRejectReason(status) {
    if (status === client_1.OmsOrderStatus.cancelled || status === client_1.OmsOrderStatus.rejected) {
        return 'Order is cancelled';
    }
    if (status === client_1.OmsOrderStatus.returned) {
        return 'Order is already fully returned';
    }
    if (IN_PROGRESS_STATUSES.has(status)) {
        return 'Order is still in progress';
    }
    return `Order status is ${status}, expected delivered, shipped, or out_for_delivery.`;
}
function dedupeExpressReturnInputs(inputs) {
    const seen = new Set();
    const out = [];
    for (const raw of inputs) {
        const trimmed = raw.trim();
        if (!trimmed)
            continue;
        const key = trimmed.toLowerCase();
        if (seen.has(key))
            continue;
        seen.add(key);
        out.push(trimmed);
    }
    return out;
}
//# sourceMappingURL=express-return-resolve.js.map