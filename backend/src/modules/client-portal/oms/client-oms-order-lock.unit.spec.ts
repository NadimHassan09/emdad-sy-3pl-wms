import { CLIENT_DELETABLE_OMS_STATUSES, CLIENT_EDITABLE_OMS_STATUSES } from './client-oms-order-lock';

describe('client OMS order lock', () => {
  it('lets the client edit only before admin approval', () => {
    for (const s of ['draft', 'waiting_for_confirmation', 'confirmed_waiting_for_admin_approval']) {
      expect(CLIENT_EDITABLE_OMS_STATUSES.has(s)).toBe(true);
    }
    for (const s of ['approved', 'processing', 'picking', 'shipped', 'delivered', 'cancelled', 'rejected']) {
      expect(CLIENT_EDITABLE_OMS_STATUSES.has(s)).toBe(false);
    }
  });

  it('lets the client delete only unconfirmed orders', () => {
    expect([...CLIENT_DELETABLE_OMS_STATUSES].sort()).toEqual(['draft', 'waiting_for_confirmation']);
  });
});
