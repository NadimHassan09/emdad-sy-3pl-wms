"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.outboundRequiresPacking = outboundRequiresPacking;
exports.nextOutboundAdminAction = nextOutboundAdminAction;
exports.assertOutboundAdminStageAction = assertOutboundAdminStageAction;
const client_1 = require("@prisma/client");
const domain_exceptions_1 = require("../../common/errors/domain-exceptions");
const outbound_confirm_lock_util_1 = require("./outbound-confirm-lock.util");
function outboundRequiresPacking(flags) {
    return flags.requiresPacking !== false && flags.planRequiresPacking !== false;
}
function nextOutboundAdminAction(status, requiresPacking) {
    if ((0, outbound_confirm_lock_util_1.isOutboundConfirmable)(status))
        return 'approve';
    if (status === client_1.OutboundOrderStatus.picking || status === 'picking') {
        return 'complete_picking';
    }
    if (status === client_1.OutboundOrderStatus.packing || status === 'packing') {
        return requiresPacking ? 'complete_packing' : null;
    }
    if (status === client_1.OutboundOrderStatus.waiting_for_shipping_method ||
        status === 'waiting_for_shipping_method') {
        return 'select_shipping_method';
    }
    if (status === client_1.OutboundOrderStatus.waiting_for_shipping_details ||
        status === 'waiting_for_shipping_details') {
        return 'complete_shipping_details';
    }
    if (status === client_1.OutboundOrderStatus.ready_to_ship || status === 'ready_to_ship') {
        return 'complete_dispatch';
    }
    return null;
}
function assertOutboundAdminStageAction(status, action, requiresPacking) {
    const expected = nextOutboundAdminAction(status, requiresPacking);
    if (action === 'approve') {
        if (!(0, outbound_confirm_lock_util_1.isOutboundConfirmable)(status)) {
            throw new domain_exceptions_1.InvalidStateException(`Approve is only valid while waiting for approval (current: ${status}).`);
        }
        return;
    }
    if (action === 'complete_picking') {
        if (status !== client_1.OutboundOrderStatus.picking && status !== 'picking') {
            throw new domain_exceptions_1.InvalidStateException(`Mark Picking Complete requires status picking (current: ${status}).`);
        }
        return;
    }
    if (action === 'complete_packing') {
        if (!requiresPacking) {
            throw new domain_exceptions_1.InvalidStateException('Packing is not required for this order; packing completion is not allowed.');
        }
        if (status !== client_1.OutboundOrderStatus.packing && status !== 'packing') {
            throw new domain_exceptions_1.InvalidStateException(`Mark Packing Complete requires status packing (current: ${status}).`);
        }
        return;
    }
    if (action === 'select_shipping_method') {
        if (status !== client_1.OutboundOrderStatus.waiting_for_shipping_method &&
            status !== 'waiting_for_shipping_method') {
            throw new domain_exceptions_1.InvalidStateException(`Select Shipping Method requires status waiting_for_shipping_method (current: ${status}).`);
        }
        return;
    }
    if (action === 'complete_shipping_details') {
        if (status !== client_1.OutboundOrderStatus.waiting_for_shipping_details &&
            status !== 'waiting_for_shipping_details') {
            throw new domain_exceptions_1.InvalidStateException(`Mark Shipping Details Complete requires status waiting_for_shipping_details (current: ${status}).`);
        }
        return;
    }
    if (action === 'complete_dispatch') {
        if (status !== client_1.OutboundOrderStatus.ready_to_ship && status !== 'ready_to_ship') {
            throw new domain_exceptions_1.InvalidStateException(`Mark Dispatch Complete requires status ready_to_ship / Waiting for Dispatch (current: ${status}).`);
        }
        return;
    }
    if (expected !== action) {
        throw new domain_exceptions_1.InvalidStateException(`Outbound admin action ${action} is not valid for status ${status}.`);
    }
}
//# sourceMappingURL=outbound-admin-stages.js.map