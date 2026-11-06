import { ForbiddenException } from '@nestjs/common';

import { assertClientMayChangeWmsOrder, isClientEditableWmsStatus } from './client-order-lock';

describe('client WMS order lock', () => {
  it('lets the client change orders until the warehouse approves them', () => {
    expect(isClientEditableWmsStatus('draft')).toBe(true);
    expect(isClientEditableWmsStatus('pending_approval')).toBe(true);
  });

  it.each(['confirmed', 'allocated', 'picking', 'in_progress', 'completed', 'shipped', 'cancelled'])(
    'blocks changes once %s',
    (status) => {
      expect(isClientEditableWmsStatus(status)).toBe(false);
      expect(() => assertClientMayChangeWmsOrder(status)).toThrow(ForbiddenException);
    },
  );
});
