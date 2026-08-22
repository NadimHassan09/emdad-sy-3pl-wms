"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isInboundAdminConfirmable = isInboundAdminConfirmable;
exports.nextInboundAdminAction = nextInboundAdminAction;
exports.assertInboundAdminStageAction = assertInboundAdminStageAction;
const client_1 = require("@prisma/client");
const domain_exceptions_1 = require("../../common/errors/domain-exceptions");
const INBOUND_CONFIRMABLE = [
    client_1.InboundOrderStatus.draft,
    client_1.InboundOrderStatus.pending_approval,
];
function isInboundAdminConfirmable(status) {
    return INBOUND_CONFIRMABLE.includes(status);
}
function nextInboundAdminAction(status, openTask = null) {
    if (isInboundAdminConfirmable(status))
        return 'approve';
    if (status === client_1.InboundOrderStatus.in_progress ||
        status === 'in_progress' ||
        status === client_1.InboundOrderStatus.partially_received ||
        status === 'partially_received') {
        if (openTask === 'receiving')
            return 'complete_receiving';
        if (openTask === 'putaway')
            return 'complete_putaway';
        return openTask === null ? 'complete_receiving' : null;
    }
    return null;
}
function assertInboundAdminStageAction(status, action) {
    if (action === 'approve') {
        if (!isInboundAdminConfirmable(status)) {
            throw new domain_exceptions_1.InvalidStateException(`Approve is only valid while waiting for approval (current: ${status}).`);
        }
        return;
    }
    const active = status === client_1.InboundOrderStatus.in_progress ||
        status === 'in_progress' ||
        status === client_1.InboundOrderStatus.partially_received ||
        status === 'partially_received';
    if (action === 'complete_receiving') {
        if (!active) {
            throw new domain_exceptions_1.InvalidStateException(`Mark Receiving Complete requires an active inbound order (current: ${status}).`);
        }
        return;
    }
    if (action === 'complete_putaway') {
        if (!active) {
            throw new domain_exceptions_1.InvalidStateException(`Mark Putaway Complete requires an active inbound order (current: ${status}).`);
        }
        return;
    }
    throw new domain_exceptions_1.InvalidStateException(`Inbound admin action ${action} is not valid for status ${status}.`);
}
//# sourceMappingURL=inbound-admin-stages.js.map