"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OMS_PRE_FULFILLMENT = exports.OMS_TERMINAL_STATUSES = exports.OMS_PRIMARY_STATUSES = void 0;
exports.assertOmsTransition = assertOmsTransition;
exports.resolveOmsActorRole = resolveOmsActorRole;
const client_1 = require("@prisma/client");
const domain_exceptions_1 = require("../../common/errors/domain-exceptions");
exports.OMS_PRIMARY_STATUSES = new Set([
    client_1.OmsOrderStatus.waiting_for_confirmation,
    client_1.OmsOrderStatus.confirmed_waiting_for_admin_approval,
    client_1.OmsOrderStatus.processing,
    client_1.OmsOrderStatus.ready_to_ship,
    client_1.OmsOrderStatus.shipped,
    client_1.OmsOrderStatus.delivered,
    client_1.OmsOrderStatus.cancelled,
    client_1.OmsOrderStatus.failed_delivery,
    client_1.OmsOrderStatus.returned,
]);
exports.OMS_TERMINAL_STATUSES = new Set([
    client_1.OmsOrderStatus.rejected,
    client_1.OmsOrderStatus.cancelled,
    client_1.OmsOrderStatus.completed,
    client_1.OmsOrderStatus.delivered,
    client_1.OmsOrderStatus.failed_delivery,
    client_1.OmsOrderStatus.returned,
]);
exports.OMS_PRE_FULFILLMENT = new Set([
    client_1.OmsOrderStatus.waiting_for_confirmation,
    client_1.OmsOrderStatus.confirmed_waiting_for_admin_approval,
    client_1.OmsOrderStatus.pending_approval,
    client_1.OmsOrderStatus.draft,
]);
const ALLOWED = {
    [`${client_1.OmsOrderStatus.waiting_for_confirmation}|client_confirm|client`]: client_1.OmsOrderStatus.confirmed_waiting_for_admin_approval,
    [`${client_1.OmsOrderStatus.waiting_for_confirmation}|admin_confirm|admin`]: client_1.OmsOrderStatus.processing,
    [`${client_1.OmsOrderStatus.confirmed_waiting_for_admin_approval}|admin_approve|admin`]: client_1.OmsOrderStatus.processing,
    [`${client_1.OmsOrderStatus.pending_approval}|admin_approve|admin`]: client_1.OmsOrderStatus.processing,
    [`${client_1.OmsOrderStatus.waiting_for_confirmation}|cancel|client`]: client_1.OmsOrderStatus.cancelled,
    [`${client_1.OmsOrderStatus.waiting_for_confirmation}|cancel|admin`]: client_1.OmsOrderStatus.cancelled,
    [`${client_1.OmsOrderStatus.confirmed_waiting_for_admin_approval}|cancel|client`]: client_1.OmsOrderStatus.cancelled,
    [`${client_1.OmsOrderStatus.confirmed_waiting_for_admin_approval}|cancel|admin`]: client_1.OmsOrderStatus.cancelled,
    [`${client_1.OmsOrderStatus.pending_approval}|cancel|client`]: client_1.OmsOrderStatus.cancelled,
    [`${client_1.OmsOrderStatus.pending_approval}|cancel|admin`]: client_1.OmsOrderStatus.cancelled,
    [`${client_1.OmsOrderStatus.draft}|cancel|admin`]: client_1.OmsOrderStatus.cancelled,
    [`${client_1.OmsOrderStatus.processing}|cancel|admin`]: client_1.OmsOrderStatus.cancelled,
    [`${client_1.OmsOrderStatus.pending}|cancel|admin`]: client_1.OmsOrderStatus.cancelled,
    [`${client_1.OmsOrderStatus.ready_to_ship}|cancel|admin`]: client_1.OmsOrderStatus.cancelled,
    [`${client_1.OmsOrderStatus.allocated}|cancel|admin`]: client_1.OmsOrderStatus.cancelled,
    [`${client_1.OmsOrderStatus.picking}|cancel|admin`]: client_1.OmsOrderStatus.cancelled,
    [`${client_1.OmsOrderStatus.packing}|cancel|admin`]: client_1.OmsOrderStatus.cancelled,
    [`${client_1.OmsOrderStatus.confirmed_waiting_for_admin_approval}|reject|admin`]: client_1.OmsOrderStatus.cancelled,
    [`${client_1.OmsOrderStatus.pending_approval}|reject|admin`]: client_1.OmsOrderStatus.cancelled,
    [`${client_1.OmsOrderStatus.waiting_for_confirmation}|reject|admin`]: client_1.OmsOrderStatus.cancelled,
    [`${client_1.OmsOrderStatus.shipped}|mark_delivered|admin`]: client_1.OmsOrderStatus.delivered,
    [`${client_1.OmsOrderStatus.out_for_delivery}|mark_delivered|admin`]: client_1.OmsOrderStatus.delivered,
    [`${client_1.OmsOrderStatus.delivered}|delivery_revert|admin`]: client_1.OmsOrderStatus.shipped,
    [`${client_1.OmsOrderStatus.shipped}|failed_delivery|admin`]: client_1.OmsOrderStatus.failed_delivery,
    [`${client_1.OmsOrderStatus.out_for_delivery}|failed_delivery|admin`]: client_1.OmsOrderStatus.failed_delivery,
    [`${client_1.OmsOrderStatus.ready_to_ship}|failed_delivery|admin`]: client_1.OmsOrderStatus.failed_delivery,
    [`${client_1.OmsOrderStatus.delivered}|mark_returned|system`]: client_1.OmsOrderStatus.returned,
    [`${client_1.OmsOrderStatus.delivered}|mark_returned|admin`]: client_1.OmsOrderStatus.returned,
};
function assertOmsTransition(from, action, actor) {
    const key = `${from}|${action}|${actor}`;
    const next = ALLOWED[key];
    if (!next) {
        throw new domain_exceptions_1.InvalidStateException(`OMS transition not allowed: ${from} —[${action}/${actor}]→`);
    }
    return next;
}
function resolveOmsActorRole(role) {
    if (role === 'client_admin' || role === 'client_staff')
        return 'client';
    return 'admin';
}
//# sourceMappingURL=oms-order-transitions.js.map