import { publicOmsOrder, publicOmsOrderListItem } from './public-order.serialize';

describe('publicOmsOrder (Client Portal parity)', () => {
  it('returns portal-visible detail fields only', () => {
    const view = publicOmsOrder({
      id: '11111111-1111-1111-1111-111111111111',
      orderNumber: 'OMS-2026-00001',
      status: 'processing',
      externalReference: 'SHOP-12345',
      recipientName: 'Nadim Hassan',
      recipientPhone: '+963966666666',
      addressLine1: 'أبراج',
      city: 'حلب',
      district: 'مدينة حلب',
      carrier: 'Babel Express',
      trackingNumber: '260303380991',
      requiredShipDate: '2026-08-22',
      createdAt: '2026-08-22T10:46:55.000Z',
      warehouseStatus: 'waiting_for_shipping_details',
      paymentMethod: 'COD',
      subtotal: '1',
      currency: 'USD',
      codStatus: 'pending',
      shippingReceiverLat: '36.2',
      shippingReceiverLng: '37.1',
      apiSecret: 'SHOULD-NOT-APPEAR',
      companyId: 'SHOULD-NOT-APPEAR-AS-TOP',
      lines: [
        {
          lineNumber: 1,
          product: { sku: 'SKU-4QYMC6', name: 'مروحة' },
          requestedQuantity: '1',
          unitPrice: '1',
          lineTotal: '1',
        },
      ],
      timeline: [{ eventType: 'oms.created', createdAt: '2026-08-22T10:46:55.000Z' }],
    } as never);

    expect(view.orderNumber).toBe('OMS-2026-00001');
    expect(view.externalOrderId).toBe('SHOP-12345');
    expect(view.address).toBe('أبراج');
    expect(view.carrier).toBe('Babel Express');
    expect(view.lines[0]).toMatchObject({
      sku: 'SKU-4QYMC6',
      productName: 'مروحة',
      quantity: 1,
      unitPrice: 1,
      lineTotal: 1,
    });
    expect(view.timeline).toHaveLength(1);
    expect(JSON.stringify(view)).not.toContain('SHOULD-NOT-APPEAR');
    expect(JSON.stringify(view)).not.toContain('shippingReceiverLat');
    expect(view).not.toHaveProperty('id');
    expect(view).not.toHaveProperty('coordinates');
  });

  it('list item matches Online orders table columns', () => {
    const row = publicOmsOrderListItem({
      id: '11111111-1111-1111-1111-111111111111',
      orderNumber: 'OMS-2026-02754',
      status: 'confirmed_waiting_for_admin_approval',
      recipientName: 'حسام حسن',
      city: 'إدلب',
      total: '20',
      currency: 'USD',
      createdAt: '2026-08-23T08:00:11.000Z',
      needsInformation: true,
      externalReference: 'SHOP-1',
    } as never);
    expect(row).toEqual({
      orderNumber: 'OMS-2026-02754',
      status: 'confirmed_waiting_for_admin_approval',
      recipientName: 'حسام حسن',
      city: 'إدلب',
      total: '20',
      currency: 'USD',
      createdAt: '2026-08-23T08:00:11.000Z',
      incomplete: true,
      externalOrderId: 'SHOP-1',
    });
    expect(row).not.toHaveProperty('id');
  });
});
