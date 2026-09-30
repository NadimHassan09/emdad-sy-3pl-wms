"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OMS_RETURN_ELIGIBLE_STATUSES = void 0;
exports.isOmsReturnEligibleStatus = isOmsReturnEligibleStatus;
const client_1 = require("@prisma/client");
exports.OMS_RETURN_ELIGIBLE_STATUSES = new Set([
    client_1.OmsOrderStatus.delivered,
    client_1.OmsOrderStatus.shipped,
    client_1.OmsOrderStatus.out_for_delivery,
    client_1.OmsOrderStatus.failed_delivery,
]);
function isOmsReturnEligibleStatus(status) {
    if (!status)
        return false;
    return exports.OMS_RETURN_ELIGIBLE_STATUSES.has(status);
}
//# sourceMappingURL=oms-return-eligibility.js.map