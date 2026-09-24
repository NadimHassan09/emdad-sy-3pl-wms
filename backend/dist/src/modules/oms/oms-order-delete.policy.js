"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isOmsOrderDeletable = isOmsOrderDeletable;
exports.omsOrderDeleteBlockedMessage = omsOrderDeleteBlockedMessage;
exports.assertOmsOrderDeletable = assertOmsOrderDeletable;
const client_1 = require("@prisma/client");
const domain_exceptions_1 = require("../../common/errors/domain-exceptions");
function isOmsOrderDeletable(status) {
    return status === client_1.OmsOrderStatus.cancelled || status === 'cancelled';
}
function omsOrderDeleteBlockedMessage(status) {
    if (status === client_1.OmsOrderStatus.completed || status === 'completed') {
        return ('Completed OMS orders cannot be deleted. ' +
            'They must remain available for audit and traceability.');
    }
    const label = typeof status === 'string' && status.trim() ? status : String(status ?? 'unknown');
    return (`Only cancelled OMS orders can be deleted. ` +
        `This order is "${label}" and must stay available for operational history.`);
}
function assertOmsOrderDeletable(status) {
    if (!isOmsOrderDeletable(status)) {
        throw new domain_exceptions_1.InvalidStateException(omsOrderDeleteBlockedMessage(status));
    }
}
//# sourceMappingURL=oms-order-delete.policy.js.map