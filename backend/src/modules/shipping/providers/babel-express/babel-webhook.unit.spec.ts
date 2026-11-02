import {
  BABEL_WEBHOOK_EVENTS,
  BabelExpressAdapter,
  babelWebhookSignature,
  generateBabelWebhookKey,
} from './babel-express.adapter';
import { BabelExpressHttpClient } from './babel-express.http-client';

describe('Babel Express webhook contract', () => {
  let adapter: BabelExpressAdapter;
  let mockHttp: jest.Mocked<BabelExpressHttpClient>;

  beforeEach(() => {
    mockHttp = { post: jest.fn() } as any;
    adapter = new BabelExpressAdapter(mockHttp);
  });

  it('accepts the documented test handshake without a signature', () => {
    expect(adapter.verifyWebhook({}, { type: 'test' }, undefined)).toBe(true);
    expect(adapter.normalizeWebhook({}, { type: 'test' })).toBeNull();
  });

  it('accepts a valid SHA-256 of awb|type|webhook_key and rejects an invalid signature', () => {
    const key = generateBabelWebhookKey();
    expect(key.length).toBeGreaterThanOrEqual(32);
    const payload = {
      type: 'Delivered',
      awb: 'AWB123456',
      reference: 'ORDER-1',
      time: 1725542701,
      verify: babelWebhookSignature('AWB123456', 'Delivered', key),
    };
    expect(adapter.verifyWebhook({}, payload, key)).toBe(true);
    expect(adapter.verifyWebhook({}, { ...payload, verify: 'deadbeef' }, key)).toBe(false);
    expect(adapter.verifyWebhook({}, payload, undefined)).toBe(false);
    expect(adapter.verifyWebhook({}, { ...payload, type: 'OutForDelivery' }, key)).toBe(false);
  });

  it('subscribes to every documented webhook event including ChangedReceiver', async () => {
    mockHttp.post.mockResolvedValueOnce({ status: 'success' });
    const result = await adapter.registerWebhook(
      { username: 'user', password: 'pwd' },
      'https://staging-admin.emdadsy.com/api/shipping/webhooks/BABEL_EXPRESS',
      '',
    );
    expect(result.ok).toBe(true);
    expect(result.secret).toHaveLength(64);
    expect(mockHttp.post).toHaveBeenCalledWith(
      'registerWebhook',
      { username: 'user', password: 'pwd' },
      expect.objectContaining({
        webhook: expect.objectContaining({
          enabled: true,
          url: 'https://staging-admin.emdadsy.com/api/shipping/webhooks/BABEL_EXPRESS',
          subscribedEvents: [...BABEL_WEBHOOK_EVENTS],
        }),
      }),
    );
    expect(BABEL_WEBHOOK_EVENTS).toEqual(
      expect.arrayContaining(['ChangedReceiver', 'CreatedFollowupShipment', 'ReturnedToSender']),
    );
    expect(BABEL_WEBHOOK_EVENTS).not.toEqual(
      expect.arrayContaining(['Cancelled', 'Deleted', 'Canceled']),
    );
  });

  it.each([
    ['ChangedReceiver', 'in_transit'],
    ['ArrivedToHub', 'in_transit'],
    ['EnRoute', 'in_transit'],
    ['DeliveryContact', 'unknown'],
    ['DeliveryFailed', 'delivery_failed'],
    ['OutForDelivery', 'out_for_delivery'],
    ['Delivered', 'delivered'],
    ['ReturnedToSender', 'returned_to_sender'],
    ['Disposed', 'unknown'],
    ['ShipmentLost', 'unknown'],
  ] as const)('maps documented event %s', (type, status) => {
    const event = adapter.normalizeWebhook(
      {},
      { type, awb: 'AWB1', reference: 'OMS-1', time: 1, details: { name: 'Hub' } },
    );
    expect(event?.eventType).toBe(type);
    expect(event?.normalizedStatus).toBe(status);
    expect(event?.reference).toBe('OMS-1');
  });

  it('maps CreatedFollowupShipment return vs receiverChange from the documented details', () => {
    const returned = adapter.normalizeWebhook(
      {},
      {
        type: 'CreatedFollowupShipment',
        awb: 'AWB1',
        time: 1,
        details: { newAwb: 'RET-1', followupType: 'return' },
      },
    );
    expect(returned?.normalizedStatus).toBe('return_created');
    expect(returned?.carrierReturnStage).toBe('return_created');

    const receiverChange = adapter.normalizeWebhook(
      {},
      {
        type: 'CreatedFollowupShipment',
        awb: 'AWB1',
        time: 1,
        details: { newAwb: 'NEW-1', followupType: 'receiverChange' },
      },
    );
    expect(receiverChange?.normalizedStatus).toBe('unknown');
    expect(receiverChange?.carrierReturnStage).toBeUndefined();
  });

  it('does not report registration success unless Babel returns status=success', async () => {
    mockHttp.post.mockResolvedValueOnce({
      status: 'error',
      errorMessage: 'url validation error - Connection timed out',
    });
    const result = await adapter.registerWebhook(
      { username: 'user', password: 'pwd' },
      'https://staging-admin.emdadsy.com/api/shipping/webhooks/BABEL_EXPRESS',
      generateBabelWebhookKey(),
    );
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/url validation error/i);
  });
});
