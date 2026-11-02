import { BabelExpressAdapter } from './babel-express.adapter';
import { BabelExpressHttpClient } from './babel-express.http-client';

describe('BabelExpressAdapter.getTrackingHistory', () => {
  let adapter: BabelExpressAdapter;
  let mockHttp: jest.Mocked<BabelExpressHttpClient>;

  beforeEach(() => {
    mockHttp = {
      post: jest.fn(),
    } as any;
    adapter = new BabelExpressAdapter(mockHttp);
  });

  it('returns formatted events sorted descending (newest first)', async () => {
    mockHttp.post.mockResolvedValueOnce({
      status: 'success',
      tracking: {
        awb: '260303139882',
        isDelivered: true,
        deliverDate: 1789567263,
        shipmentStatus: { text: 'تم التسليم', color: 'success' },
        updates: [
          {
            text: 'تم تكوين الشحنة',
            time: 1789465007,
            location: '',
            color: 'default',
            code: 'Created',
          },
          {
            text: 'تم تسليم الشحنة',
            time: 1789567263,
            location: 'الشيخ مقصود, مدينة حلب',
            color: 'success',
            code: 'Delivered',
          },
          {
            text: 'وصلت الشحنة الى نقطة التحويل',
            time: 1789478599,
            location: 'حلب الجديدة, مدينة حلب',
            color: 'default',
            code: 'ArrivedToHub',
          },
        ],
      },
    });

    const res = await adapter.getTrackingHistory(
      { username: 'user', password: 'pwd' },
      '260303139882',
    );

    expect(res).not.toBeNull();
    expect(res?.providerCode).toBe('BABEL_EXPRESS');
    expect(res?.awb).toBe('260303139882');
    expect(res?.isDelivered).toBe(true);
    expect(res?.statusLabel).toBe('تم التسليم');
    expect(res?.events).toHaveLength(3);

    // Verify descending order: newest (Delivered) -> ArrivedToHub -> Created
    expect(res?.events[0].title).toBe('تم تسليم الشحنة');
    expect(res?.events[0].location).toBe('الشيخ مقصود, مدينة حلب');
    expect(res?.events[0].color).toBe('success');

    expect(res?.events[1].title).toBe('وصلت الشحنة الى نقطة التحويل');
    expect(res?.events[1].location).toBe('حلب الجديدة, مدينة حلب');

    expect(res?.events[2].title).toBe('تم تكوين الشحنة');
    expect(res?.events[2].location).toBeNull();
  });

  it('handles empty tracking or non-success gracefully', async () => {
    mockHttp.post.mockResolvedValueOnce({
      status: 'error',
      errorMessage: 'Shipment not found',
    });

    const res = await adapter.getTrackingHistory(
      { username: 'user', password: 'pwd' },
      'non-existent',
    );

    expect(res).not.toBeNull();
    expect(res?.events).toEqual([]);
    expect(res?.lookupState).toBe('not_found');
    expect(res?.cancellationUnconfirmed).toBe(true);
    expect(res?.error).toBeUndefined();
    expect(res?.message).toMatch(/cancellation is not confirmed/i);
  });

  it('keeps contact and no-answer updates as their own movement rows', async () => {
    mockHttp.post.mockResolvedValueOnce({
      status: 'success',
      tracking: {
        awb: '260302737385',
        isDelivered: false,
        shipmentStatus: { text: 'خرجت الشحنة للتسليم', color: 'info' },
        updates: [
          {
            text: 'فشل الاتصال بالمستلم لتحديد التسليم - تم الاتصال ولم يتم الرد',
            time: 1787819932,
            location: 'البرامكة, محافظة دمشق',
            color: 'error',
            code: 'DeliveryContact',
          },
          {
            text: 'خرجت الشحنة للتسليم',
            time: 1787900000,
            location: 'البرامكة, محافظة دمشق',
            color: 'info',
            code: 'OutForDelivery',
          },
        ],
      },
    });

    const res = await adapter.getTrackingHistory(
      { username: 'user', password: 'pwd' },
      '260302737385',
    );
    expect(res?.events.map((event) => event.title)).toEqual([
      'خرجت الشحنة للتسليم',
      'فشل الاتصال بالمستلم لتحديد التسليم - تم الاتصال ولم يتم الرد',
    ]);
    expect(res?.events[1].location).toBe('البرامكة, محافظة دمشق');
  });

  it('does not treat a contact webhook as a failed delivery', () => {
    const event = adapter.normalizeWebhook({}, {
      awb: '260302737385',
      type: 'DeliveryContact',
      time: 1787819932,
      details: { reason: 'تم الاتصال ولم يتم الرد' },
    });
    expect(event?.normalizedStatus).toBe('unknown');
    expect(event?.eventType).toBe('DeliveryContact');
    expect(event?.notes).toBe('تم الاتصال ولم يتم الرد');
  });

  it('does not turn a no-answer poll into a failed delivery', async () => {
    mockHttp.post.mockResolvedValueOnce({
      status: 'success',
      tracking: {
        isDelivered: false,
        shipmentStatus: { text: 'فشل الاتصال بالمستلم لتحديد التسليم - تم الاتصال ولم يتم الرد' },
        updates: [
          { text: 'فشل الاتصال بالمستلم لتحديد التسليم - تم الاتصال ولم يتم الرد' },
        ],
      },
    });
    const event = await adapter.pollTracking({ username: 'user', password: 'pwd' }, '260302737385');
    expect(event?.normalizedStatus).toBe('unknown');
  });

  it('still maps DeliveryFailed to a failed delivery', () => {
    const event = adapter.normalizeWebhook({}, {
      awb: '260302737385',
      type: 'DeliveryFailed',
      time: 1787819932,
    });
    expect(event?.normalizedStatus).toBe('delivery_failed');
  });

  it('handles API exceptions gracefully without throwing', async () => {
    mockHttp.post.mockRejectedValueOnce(new Error('Network timeout'));

    const res = await adapter.getTrackingHistory(
      { username: 'user', password: 'pwd' },
      '260303139882',
    );

    expect(res).not.toBeNull();
    expect(res?.events).toEqual([]);
    expect(res?.lookupState).toBe('error');
    expect(res?.cancellationUnconfirmed).toBe(false);
    expect(res?.error).toContain('Network timeout');
  });

  it('pollTracking classifies Shipment not found as unconfirmed, not cancelled', async () => {
    mockHttp.post.mockRejectedValueOnce(new Error('Shipment not found'));
    const event = await adapter.pollTracking({ username: 'user', password: 'pwd' }, '260303707929');
    expect(event?.eventType).toBe('provider.lookup_not_found');
    expect(event?.normalizedStatus).toBe('unknown');
    expect(event?.externalEventId).toBe('provider.lookup_not_found:260303707929');
  });

  it('pollTracking does not invent cancellation on a network timeout', async () => {
    mockHttp.post.mockRejectedValueOnce(new Error('Network timeout'));
    const event = await adapter.pollTracking({ username: 'user', password: 'pwd' }, '260303707929');
    expect(event).toBeNull();
  });
});
