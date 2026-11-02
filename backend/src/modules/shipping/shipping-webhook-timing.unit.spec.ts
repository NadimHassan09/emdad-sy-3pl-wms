import {
  buildShippingWebhookTimingLog,
  providerEventTimeIso,
  timingLogContainsSecrets,
} from './shipping-webhook-timing';
import { babelWebhookSignature } from './providers/babel-express/babel-express.adapter';

describe('shipping webhook timing instrumentation', () => {
  it('10. never logs secrets or signature material', () => {
    const key = 'super-secret-webhook-key';
    const log = buildShippingWebhookTimingLog({
      providerCode: 'BABEL_EXPRESS',
      handshake: false,
      receivedAt: new Date('2026-10-22T09:40:00.000Z'),
      verifiedMs: 4,
      processedMs: 18,
      totalMs: 22,
      providerEventTime: '2026-10-22T09:39:50.000Z',
      awb: '260303707929',
      eventType: 'EnRoute',
      externalEventId: '260303707929:EnRoute:1729600000',
      action: 'tracking_recorded:in_transit',
      orderId: 'oms-1',
    });
    const leaked = {
      ...log,
      verify: babelWebhookSignature('260303707929', 'EnRoute', key),
      webhook_key: key,
      password: 'carrier-pass',
    };

    expect(log.msg).toBe('shipping_webhook_timing');
    expect(timingLogContainsSecrets(log)).toBe(false);
    expect(JSON.stringify(log)).not.toContain(key);
    expect(JSON.stringify(log)).not.toContain('password');
    expect(JSON.stringify(log)).not.toContain('webhook_key');
    expect(JSON.stringify(log)).not.toContain('"verify"');
    expect(timingLogContainsSecrets(leaked)).toBe(true);
  });

  it('uses Babel unix `time` and Sila occurred_at without changing the signature contract', () => {
    expect(
      providerEventTimeIso({ type: 'EnRoute', awb: 'A1', time: 1725542701, verify: 'deadbeef' }),
    ).toBe(new Date(1725542701 * 1000).toISOString());
    expect(
      providerEventTimeIso({
        event: 'cargo.status',
        occurred_at: '2026-10-22T08:00:00.000Z',
      }),
    ).toBe('2026-10-22T08:00:00.000Z');
    expect(providerEventTimeIso({ type: 'test' })).toBeNull();
  });

  it('records delivery lag separately from internal processing', () => {
    const receivedAt = new Date('2026-10-22T09:50:00.000Z');
    const log = buildShippingWebhookTimingLog({
      providerCode: 'SILA_SY',
      handshake: false,
      receivedAt,
      verifiedMs: 3,
      processedMs: 19,
      totalMs: 24,
      providerEventTime: '2026-10-22T09:49:40.000Z',
      awb: 'sila-cargo',
      eventType: 'cargo.status',
      action: 'tracking_recorded:in_transit',
    });
    expect(log.deliveryLagMs).toBe(20_000);
    expect(log.processedMs).toBe(19);
    expect(log.verifiedMs).toBe(3);
  });
});
