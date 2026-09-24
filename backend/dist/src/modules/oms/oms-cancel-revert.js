"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OMS_FULFILLMENT_RESTORE_STATUSES = exports.UNSAFE_OUTBOUND_RESTORE_STATUSES = exports.UNSAFE_OMS_RESTORE_STATUSES = exports.CLIENT_CANCEL_REVERT_STATUSES = void 0;
exports.isRestorableOmsStatus = isRestorableOmsStatus;
exports.isRestorableOutboundStatus = isRestorableOutboundStatus;
exports.parseOmsStatus = parseOmsStatus;
exports.parseOutboundStatus = parseOutboundStatus;
exports.snapshotOnEnteringCancelled = snapshotOnEnteringCancelled;
exports.resolvePreviousOmsStatus = resolvePreviousOmsStatus;
exports.assertPreviousOmsStatusOrThrow = assertPreviousOmsStatusOrThrow;
exports.clientMayRevertTo = clientMayRevertTo;
exports.canRevertCancel = canRevertCancel;
exports.resolveOutboundRestoreStatus = resolveOutboundRestoreStatus;
exports.needsReallocation = needsReallocation;
const client_1 = require("@prisma/client");
const domain_exceptions_1 = require("../../common/errors/domain-exceptions");
exports.CLIENT_CANCEL_REVERT_STATUSES = new Set([
    client_1.OmsOrderStatus.waiting_for_confirmation,
    client_1.OmsOrderStatus.confirmed_waiting_for_admin_approval,
    client_1.OmsOrderStatus.pending_approval,
]);
exports.UNSAFE_OMS_RESTORE_STATUSES = new Set([
    client_1.OmsOrderStatus.cancelled,
    client_1.OmsOrderStatus.rejected,
    client_1.OmsOrderStatus.delivered,
    client_1.OmsOrderStatus.returned,
    client_1.OmsOrderStatus.failed_delivery,
    client_1.OmsOrderStatus.completed,
]);
exports.UNSAFE_OUTBOUND_RESTORE_STATUSES = new Set([
    client_1.OutboundOrderStatus.cancelled,
    client_1.OutboundOrderStatus.delivered,
    client_1.OutboundOrderStatus.returned,
]);
exports.OMS_FULFILLMENT_RESTORE_STATUSES = new Set([
    client_1.OmsOrderStatus.processing,
    client_1.OmsOrderStatus.pending,
    client_1.OmsOrderStatus.approved,
    client_1.OmsOrderStatus.confirmed,
    client_1.OmsOrderStatus.allocated,
    client_1.OmsOrderStatus.picking,
    client_1.OmsOrderStatus.packing,
    client_1.OmsOrderStatus.ready_to_ship,
]);
const OMS_STATUS_VALUES = new Set(Object.values(client_1.OmsOrderStatus));
const OUTBOUND_STATUS_VALUES = new Set(Object.values(client_1.OutboundOrderStatus));
const CANCEL_EVENT_TYPES = new Set(['oms.cancelled', 'order.cancelled']);
const EVENT_TYPE_TO_OMS = {
    'order.waiting_for_confirmation': client_1.OmsOrderStatus.waiting_for_confirmation,
    'oms.confirmed': client_1.OmsOrderStatus.confirmed_waiting_for_admin_approval,
    'oms.approved': client_1.OmsOrderStatus.processing,
    'oms.processing': client_1.OmsOrderStatus.processing,
    'order.processing': client_1.OmsOrderStatus.processing,
    'oms.ready_to_ship': client_1.OmsOrderStatus.ready_to_ship,
    'order.ready_to_ship': client_1.OmsOrderStatus.ready_to_ship,
    'order.allocated': client_1.OmsOrderStatus.allocated,
    'order.picking': client_1.OmsOrderStatus.picking,
    'order.packing': client_1.OmsOrderStatus.packing,
};
function isRestorableOmsStatus(status) {
    return !!status && !exports.UNSAFE_OMS_RESTORE_STATUSES.has(status);
}
function isRestorableOutboundStatus(status) {
    return !!status && !exports.UNSAFE_OUTBOUND_RESTORE_STATUSES.has(status);
}
function parseOmsStatus(value) {
    if (typeof value !== 'string' || !OMS_STATUS_VALUES.has(value))
        return null;
    return value;
}
function parseOutboundStatus(value) {
    if (typeof value !== 'string' || !OUTBOUND_STATUS_VALUES.has(value))
        return null;
    return value;
}
function snapshotOnEnteringCancelled(currentOmsStatus, currentOutboundStatus) {
    return {
        cancelledFromStatus: currentOmsStatus,
        cancelledFromOutboundStatus: currentOutboundStatus && currentOutboundStatus !== client_1.OutboundOrderStatus.cancelled
            ? currentOutboundStatus
            : null,
    };
}
function statusFromEvent(event) {
    const payload = event.payload && typeof event.payload === 'object'
        ? event.payload
        : null;
    const fromPayload = parseOmsStatus(payload?.omsStatus ?? payload?.status);
    if (fromPayload)
        return fromPayload;
    return EVENT_TYPE_TO_OMS[event.eventType] ?? null;
}
function resolvePreviousOmsStatus(params) {
    if (isRestorableOmsStatus(params.cancelledFromStatus ?? null)) {
        return params.cancelledFromStatus;
    }
    const events = params.events ?? [];
    const cancelIdx = [...events]
        .map((e, i) => ({ e, i }))
        .reverse()
        .find(({ e }) => CANCEL_EVENT_TYPES.has(e.eventType))?.i;
    const beforeCancel = cancelIdx == null ? events : events.slice(0, cancelIdx);
    for (let i = beforeCancel.length - 1; i >= 0; i--) {
        const status = statusFromEvent(beforeCancel[i]);
        if (isRestorableOmsStatus(status))
            return status;
        if (status && exports.UNSAFE_OMS_RESTORE_STATUSES.has(status))
            return null;
    }
    return null;
}
function assertPreviousOmsStatusOrThrow(status) {
    if (!isRestorableOmsStatus(status)) {
        throw new domain_exceptions_1.InvalidStateException('Cannot safely determine previous OMS status');
    }
    return status;
}
function clientMayRevertTo(status) {
    return exports.CLIENT_CANCEL_REVERT_STATUSES.has(status);
}
function canRevertCancel(params) {
    if (params.orderStatus !== client_1.OmsOrderStatus.cancelled)
        return false;
    if (!isRestorableOmsStatus(params.restoreTo))
        return false;
    if (params.actor === 'client')
        return clientMayRevertTo(params.restoreTo);
    return true;
}
function resolveOutboundRestoreStatus(params) {
    if (isRestorableOutboundStatus(params.cancelledFromOutboundStatus ?? null)) {
        return params.cancelledFromOutboundStatus;
    }
    if (params.outboundCancelledAt == null) {
        return params.hasActiveReservations
            ? client_1.OutboundOrderStatus.allocated
            : client_1.OutboundOrderStatus.draft;
    }
    if (isRestorableOutboundStatus(params.auditPreviousStatus ?? null)) {
        return params.auditPreviousStatus;
    }
    return null;
}
function needsReallocation(params) {
    return (exports.OMS_FULFILLMENT_RESTORE_STATUSES.has(params.omsStatus) && !params.hasActiveReservations);
}
//# sourceMappingURL=oms-cancel-revert.js.map