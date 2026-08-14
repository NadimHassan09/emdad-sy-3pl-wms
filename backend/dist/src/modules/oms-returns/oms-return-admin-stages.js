"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nextOmsReturnAdminAction = nextOmsReturnAdminAction;
exports.assertOmsReturnAdminStageAction = assertOmsReturnAdminStageAction;
const client_1 = require("@prisma/client");
const domain_exceptions_1 = require("../../common/errors/domain-exceptions");
function nextOmsReturnAdminAction(omsStatus, wh = null) {
    if (omsStatus === client_1.OmsReturnStatus.requested || omsStatus === 'requested') {
        return 'approve';
    }
    if (omsStatus !== client_1.OmsReturnStatus.approved && omsStatus !== 'approved') {
        return null;
    }
    if (!wh)
        return 'complete_receiving';
    if (wh.hasUnreceivedQty)
        return 'complete_receiving';
    if (wh.hasUnpostedQty)
        return 'complete_putaway';
    return null;
}
function assertOmsReturnAdminStageAction(omsStatus, action) {
    if (action === 'approve') {
        if (omsStatus !== client_1.OmsReturnStatus.requested && omsStatus !== 'requested') {
            throw new domain_exceptions_1.InvalidStateException(`Approve is only valid while the return is requested (current: ${omsStatus}).`);
        }
        return;
    }
    if (omsStatus !== client_1.OmsReturnStatus.approved && omsStatus !== 'approved') {
        throw new domain_exceptions_1.InvalidStateException(`Stage action ${action} requires an approved OMS return (current: ${omsStatus}).`);
    }
}
//# sourceMappingURL=oms-return-admin-stages.js.map