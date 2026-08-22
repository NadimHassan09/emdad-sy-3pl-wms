import { OutboundOrderStatus } from '@prisma/client';

import { nextOutboundAdminAction } from './outbound-admin-stages';
import { isOutboundConfirmable } from './outbound-confirm-lock.util';

describe('migrated / external fulfillment outbound stages', () => {
  it('externally_fulfilled has no admin warehouse stage CTA', () => {
    expect(nextOutboundAdminAction(OutboundOrderStatus.externally_fulfilled, true)).toBeNull();
    expect(isOutboundConfirmable(OutboundOrderStatus.externally_fulfilled)).toBe(false);
  });

  it('ready_to_ship still offers complete_dispatch (standalone / warehouse path)', () => {
    expect(nextOutboundAdminAction(OutboundOrderStatus.ready_to_ship, true)).toBe(
      'complete_dispatch',
    );
  });

  it('shipped has no further warehouse CTA (cancelled+shipped display-only)', () => {
    expect(nextOutboundAdminAction(OutboundOrderStatus.shipped, true)).toBeNull();
  });
});
