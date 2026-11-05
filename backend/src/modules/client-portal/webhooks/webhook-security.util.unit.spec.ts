import {
  isPrivateAddress,
  nextRetryDelayMinutes,
  signWebhookBody,
  validateWebhookUrlShape,
  verifyWebhookSignature,
} from './webhook-security.util';

describe('webhook security helpers', () => {
  it('signs and verifies a body, and rejects a changed body or a wrong secret', () => {
    const header = signWebhookBody('whsec_a', '{"a":1}');
    expect(verifyWebhookSignature('whsec_a', '{"a":1}', header)).toBe(true);
    expect(verifyWebhookSignature('whsec_a', '{"a":2}', header)).toBe(false);
    expect(verifyWebhookSignature('whsec_b', '{"a":1}', header)).toBe(false);
  });

  it('rejects an old signature (replay)', () => {
    const old = signWebhookBody('whsec_a', 'x', new Date(Date.now() - 3_600_000));
    expect(verifyWebhookSignature('whsec_a', 'x', old)).toBe(false);
  });

  it('accepts only public https urls', () => {
    expect(validateWebhookUrlShape('https://shop.example.com/hook').ok).toBe(true);
    for (const bad of ['http://shop.example.com', 'https://localhost/x', 'https://10.0.0.5/x', 'https://127.0.0.1/x', 'https://a:b@shop.example.com', 'nope', 'https://[::1]/x', 'https://x.internal/y']) {
      expect(validateWebhookUrlShape(bad).ok).toBe(false);
    }
  });

  it('knows private ranges', () => {
    for (const ip of ['10.1.1.1', '172.16.0.1', '192.168.1.1', '127.0.0.1', '169.254.169.254', '::1', 'fd00::1', '::ffff:10.0.0.1']) {
      expect(isPrivateAddress(ip)).toBe(true);
    }
    expect(isPrivateAddress('8.8.8.8')).toBe(false);
    expect(isPrivateAddress('172.32.0.1')).toBe(false);
  });

  it('retries five times with growing delays, then stops', () => {
    expect([1, 2, 3, 4, 5, 6].map(nextRetryDelayMinutes)).toEqual([1, 5, 30, 120, 360, null]);
  });
});
