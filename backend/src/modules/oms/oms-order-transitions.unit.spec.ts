import { OmsOrderStatus } from '@prisma/client';

import { assertOmsTransition } from './oms-order-transitions';

describe('oms-order-transitions', () => {
  it('does not expose record_external_fulfillment as a legal action', () => {
    expect(() =>
      assertOmsTransition(
        OmsOrderStatus.processing,
        'record_external_fulfillment' as never,
        'admin',
      ),
    ).toThrow(/not allowed/i);
    expect(() =>
      assertOmsTransition(
        OmsOrderStatus.pending,
        'record_external_fulfillment' as never,
        'admin',
      ),
    ).toThrow(/not allowed/i);
    expect(() =>
      assertOmsTransition(
        OmsOrderStatus.shipped,
        'record_external_fulfillment' as never,
        'admin',
      ),
    ).toThrow(/not allowed/i);
  });

  it('still allows mark_delivered from shipped (standard OMS path)', () => {
    expect(
      assertOmsTransition(OmsOrderStatus.shipped, 'mark_delivered', 'admin'),
    ).toBe(OmsOrderStatus.delivered);
  });

  it('still allows admin approve processing start', () => {
    expect(
      assertOmsTransition(
        OmsOrderStatus.confirmed_waiting_for_admin_approval,
        'admin_approve',
        'admin',
      ),
    ).toBe(OmsOrderStatus.processing);
  });
});
