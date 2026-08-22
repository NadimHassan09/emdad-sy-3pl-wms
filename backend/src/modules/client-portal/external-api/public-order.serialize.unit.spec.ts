import { publicOmsOrder } from './public-order.serialize';

describe('publicOmsOrder', () => {
  it('does not expose secrets or internal approval fields blindly', () => {
    const view = publicOmsOrder({
      id: '11111111-1111-1111-1111-111111111111',
      orderNumber: 'OMS-2026-00001',
      status: 'confirmed_waiting_for_admin_approval',
      externalReference: 'SHOP-12345',
      recipientName: 'Mahmoud',
      city: 'حلب',
      district: 'حلب',
      shippingReceiverLat: '36.2',
      shippingReceiverLng: '37.1',
      apiSecret: 'SHOULD-NOT-APPEAR',
      lines: [{ product: { sku: 'SKU-100' }, requestedQuantity: '2' }],
    } as never);
    expect(view.externalOrderId).toBe('SHOP-12345');
    expect(view.status).toBe('confirmed_waiting_for_admin_approval');
    expect(view.lines[0].sku).toBe('SKU-100');
    expect(JSON.stringify(view)).not.toContain('SHOULD-NOT-APPEAR');
  });
});
