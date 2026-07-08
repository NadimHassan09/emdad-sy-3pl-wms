import { OutboundOrderStatus } from '@prisma/client';

import {
  isOutboundConfirmable,
  OUTBOUND_CONFIRMABLE,
} from './outbound-confirm-lock.util';

describe('outbound confirm lock (OMS allocated)', () => {
  it('allows allocated orders to be confirmed', () => {
    expect(OUTBOUND_CONFIRMABLE).toContain(OutboundOrderStatus.allocated);
    expect(isOutboundConfirmable(OutboundOrderStatus.allocated)).toBe(true);
  });
});
