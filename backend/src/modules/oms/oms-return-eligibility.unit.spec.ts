import { OmsOrderStatus } from '@prisma/client';

import { isOmsReturnEligibleStatus } from './oms-return-eligibility';

describe('oms-return-eligibility', () => {
  it.each([
    OmsOrderStatus.delivered,
    OmsOrderStatus.shipped,
    OmsOrderStatus.out_for_delivery,
  ])('allows %s', (status) => {
    expect(isOmsReturnEligibleStatus(status)).toBe(true);
  });

  it.each([
    OmsOrderStatus.processing,
    OmsOrderStatus.ready_to_ship,
    OmsOrderStatus.cancelled,
    OmsOrderStatus.returned,
    OmsOrderStatus.failed_delivery,
    null,
    undefined,
    '',
  ])('rejects %s', (status) => {
    expect(isOmsReturnEligibleStatus(status as never)).toBe(false);
  });
});
