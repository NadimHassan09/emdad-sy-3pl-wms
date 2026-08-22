import {
  generateWebhookSecret,
  hashWebhookSecret,
  verifyWebhookSecret,
} from './oms-channel.util';

describe('oms-channel webhook secrets', () => {
  it('hashes and verifies secrets consistently', () => {
    const secret = generateWebhookSecret();
    const hash = hashWebhookSecret(secret);
    expect(verifyWebhookSecret(secret, hash)).toBe(true);
    expect(verifyWebhookSecret('wrong-secret', hash)).toBe(false);
  });
});
