import { DomainException } from './domain-exceptions';

export class BillingPlanRequiredException extends DomainException {
  constructor(
    message = 'An active billing plan is required before performing this action.',
  ) {
    super('BILLING_PLAN_REQUIRED', message);
  }
}

export class BillingCycleExpiredException extends DomainException {
  constructor(
    message = 'The billing cycle has expired. Renew or contact finance to restore access.',
  ) {
    super('BILLING_CYCLE_EXPIRED', message);
  }
}

export class VolumeAllocationExceededException extends DomainException {
  constructor(
    message = 'Reserved volume exceeds the 90% warehouse allocation limit.',
    details?: Record<string, unknown>,
  ) {
    super('VOLUME_ALLOCATION_EXCEEDED', message, 400, details);
  }
}
