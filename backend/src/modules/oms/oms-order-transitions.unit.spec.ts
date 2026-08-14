import { OmsOrderStatus } from '@prisma/client';

import { assertOmsTransition } from './oms-order-transitions';

describe('oms-order-transitions external fulfillment', () => {
  it('allows processing → shipped via record_external_fulfillment', () => {
    expect(
      assertOmsTransition(
        OmsOrderStatus.processing,
        'record_external_fulfillment',
        'admin',
      ),
    ).toBe(OmsOrderStatus.shipped);
  });

  it('allows pending → shipped via record_external_fulfillment (migrated B7a leftover)', () => {
    expect(
      assertOmsTransition(OmsOrderStatus.pending, 'record_external_fulfillment', 'admin'),
    ).toBe(OmsOrderStatus.shipped);
  });

  it('rejects external fulfillment from shipped (must use idempotent service path)', () => {
    expect(() =>
      assertOmsTransition(OmsOrderStatus.shipped, 'record_external_fulfillment', 'admin'),
    ).toThrow(/not allowed/i);
  });

  it('still allows mark_delivered from shipped (same path for new and migrated)', () => {
    expect(
      assertOmsTransition(OmsOrderStatus.shipped, 'mark_delivered', 'admin'),
    ).toBe(OmsOrderStatus.delivered);
  });
});
