import * as crypto from 'crypto';

import { isSilaWebhookTest, silaStatusEventId, verifySilaSignature } from './sila-webhook.util';

describe('sila-webhook.util', () => {
  it('verifies sha256 HMAC of the raw body with a whsec secret', () => {
    const secret = 'whsec_live_example';
    const raw = '{"event":"cargo.status_changed","data":{"new_status":"delivered"}}';
    const header = `sha256=${crypto.createHmac('sha256', secret).update(raw).digest('hex')}`;
    expect(verifySilaSignature(raw, header, secret)).toBe(true);
    expect(verifySilaSignature('{"event":"tampered"}', header, secret)).toBe(false);
  });

  it('acks webhook.test without producing a status event id collision', () => {
    expect(isSilaWebhookTest({ 'x-sila-event': 'webhook.test' }, { event: 'webhook.test' })).toBe(
      true,
    );
    expect(silaStatusEventId('cargo-1', 'delivered', '2026-10-21T10:00:00.000Z')).toBe(
      'sila:cargo-1:delivered:2026-10-21T10:00:00.000Z',
    );
  });
});
