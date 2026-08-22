import { OmsOrderStatus } from '@prisma/client';

import { InvalidStateException } from '../../common/errors/domain-exceptions';
import {
  assertOmsOrderDeletable,
  isOmsOrderDeletable,
  omsOrderDeleteBlockedMessage,
} from './oms-order-delete.policy';

describe('oms-order-delete.policy', () => {
  it('allows deleting cancelled OMS orders', () => {
    expect(isOmsOrderDeletable(OmsOrderStatus.cancelled)).toBe(true);
    expect(() => assertOmsOrderDeletable(OmsOrderStatus.cancelled)).not.toThrow();
  });

  it('blocks deleting completed OMS orders with an audit message', () => {
    expect(isOmsOrderDeletable(OmsOrderStatus.completed)).toBe(false);
    expect(omsOrderDeleteBlockedMessage(OmsOrderStatus.completed)).toMatch(/Completed/);
    expect(() => assertOmsOrderDeletable(OmsOrderStatus.completed)).toThrow(
      InvalidStateException,
    );
  });

  it.each([
    OmsOrderStatus.draft,
    OmsOrderStatus.pending_approval,
    OmsOrderStatus.approved,
    OmsOrderStatus.confirmed,
    OmsOrderStatus.processing,
    OmsOrderStatus.allocated,
    OmsOrderStatus.picking,
    OmsOrderStatus.packing,
    OmsOrderStatus.ready_to_ship,
    OmsOrderStatus.out_for_delivery,
    OmsOrderStatus.shipped,
    OmsOrderStatus.delivered,
    OmsOrderStatus.failed_delivery,
    OmsOrderStatus.returned,
    OmsOrderStatus.rejected,
  ] as OmsOrderStatus[])('blocks deleting %s OMS orders', (status) => {
    expect(isOmsOrderDeletable(status)).toBe(false);
    expect(() => assertOmsOrderDeletable(status)).toThrow(InvalidStateException);
    expect(omsOrderDeleteBlockedMessage(status)).toContain(status);
  });
});
