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
    expect(res?.message).toContain('Shipment not found');
  });

  it('handles API exceptions gracefully without throwing', async () => {
    mockHttp.post.mockRejectedValueOnce(new Error('Network timeout'));

    const res = await adapter.getTrackingHistory(
      { username: 'user', password: 'pwd' },
      '260303139882',
    );

    expect(res).not.toBeNull();
    expect(res?.events).toEqual([]);
    expect(res?.error).toContain('Network timeout');
  });
});
