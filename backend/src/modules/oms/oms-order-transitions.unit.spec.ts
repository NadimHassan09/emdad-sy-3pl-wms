import { OmsOrderStatus } from '@prisma/client';

import { assertOmsCancelRevert, assertOmsTransition } from './oms-order-transitions';

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

  it('allows cancel_revert only from cancelled', () => {
    expect(() => assertOmsCancelRevert(OmsOrderStatus.cancelled, 'admin')).not.toThrow();
    expect(() => assertOmsCancelRevert(OmsOrderStatus.cancelled, 'client')).not.toThrow();
    expect(() => assertOmsCancelRevert(OmsOrderStatus.processing, 'admin')).toThrow(
      /not allowed/i,
    );
  });

  it('allows admin cancel from Out for Delivery raw statuses', () => {
    expect(assertOmsTransition(OmsOrderStatus.shipped, 'cancel', 'admin')).toBe(
      OmsOrderStatus.cancelled,
    );
    expect(
      assertOmsTransition(OmsOrderStatus.out_for_delivery, 'cancel', 'admin'),
    ).toBe(OmsOrderStatus.cancelled);
  });

  it('blocks client cancel from Out for Delivery', () => {
    expect(() =>
      assertOmsTransition(OmsOrderStatus.shipped, 'cancel', 'client'),
    ).toThrow(/not allowed/i);
    expect(() =>
      assertOmsTransition(OmsOrderStatus.out_for_delivery, 'cancel', 'client'),
    ).toThrow(/not allowed/i);
  });

  it('blocks cancel from delivered', () => {
    expect(() =>
      assertOmsTransition(OmsOrderStatus.delivered, 'cancel', 'admin'),
    ).toThrow(/not allowed/i);
  });

  it('allows mark_returned from delivered and Out for Delivery', () => {
    expect(
      assertOmsTransition(OmsOrderStatus.delivered, 'mark_returned', 'system'),
    ).toBe(OmsOrderStatus.returned);
    expect(
      assertOmsTransition(OmsOrderStatus.shipped, 'mark_returned', 'admin'),
    ).toBe(OmsOrderStatus.returned);
    expect(
      assertOmsTransition(OmsOrderStatus.out_for_delivery, 'mark_returned', 'system'),
    ).toBe(OmsOrderStatus.returned);
  });
});
