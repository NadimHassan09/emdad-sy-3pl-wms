import * as crypto from 'crypto';
import { buildFatihNormalizedEvent, verifyFatihSignature } from './fatih-cargo.webhook.util';

describe('fatih-cargo.webhook', () => {
  const key = crypto.randomBytes(24);
  const secret = `whsec_${key.toString('base64')}`;

  function sign(id: string, timestamp: string, body: string): string {
    const digest = crypto.createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest('base64');
    return `v1,${digest}`;
  }

  it('verifies Standard Webhooks signatures', () => {
    const id = 'evt-1';
    const timestamp = String(Math.floor(Date.now() / 1000));
    const body = '{"type":"shipment.status_changed"}';
    const headers = {
      'webhook-id': id,
      'webhook-timestamp': timestamp,
      'webhook-signature': sign(id, timestamp, body),
    };
    expect(verifyFatihSignature(headers, body, secret)).toBe(true);
    expect(verifyFatihSignature(headers, body + 'x', secret)).toBe(false);
  });

  it('normalizes status_changed and ignores webhook.test', () => {
    expect(buildFatihNormalizedEvent({}, { type: 'webhook.test', data: { message: 'hi' } })).toBeNull();

    const event = buildFatihNormalizedEvent(
      { 'webhook-id': 'e1' },
      {
        id: 'e1',
        type: 'shipment.status_changed',
        created_at: '2026-10-02T15:14:56+03:00',
        data: {
          shipment: {
            id: 277887,
            tracking_number: '5000663',
            reference: 'ORD-10023',
            status: 'delivered',
            status_label: 'تم التسليم',
            status_changed_at: '2026-10-02T15:14:56+03:00',
          },
        },
      },
    );
    expect(event?.awb).toBe('5000663');
    expect(event?.normalizedStatus).toBe('delivered');
    expect(event?.reference).toBe('ORD-10023');
    expect(event?.providerCode).toBe('FATIH_CARGO');
  });
});
