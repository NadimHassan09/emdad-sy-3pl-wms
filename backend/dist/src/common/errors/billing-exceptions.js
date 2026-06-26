"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VolumeAllocationExceededException = exports.BillingCycleExpiredException = exports.BillingPlanRequiredException = void 0;
const domain_exceptions_1 = require("./domain-exceptions");
class BillingPlanRequiredException extends domain_exceptions_1.DomainException {
    constructor(message = 'An active billing plan is required before performing this action.') {
        super('BILLING_PLAN_REQUIRED', message);
    }
}
exports.BillingPlanRequiredException = BillingPlanRequiredException;
class BillingCycleExpiredException extends domain_exceptions_1.DomainException {
    constructor(message = 'The billing cycle has expired. Renew or contact finance to restore access.') {
        super('BILLING_CYCLE_EXPIRED', message);
    }
}
exports.BillingCycleExpiredException = BillingCycleExpiredException;
class VolumeAllocationExceededException extends domain_exceptions_1.DomainException {
    constructor(message = 'Reserved volume exceeds the 90% warehouse allocation limit.', details) {
        super('VOLUME_ALLOCATION_EXCEEDED', message, 400, details);
    }
}
exports.VolumeAllocationExceededException = VolumeAllocationExceededException;
//# sourceMappingURL=billing-exceptions.js.map