import {
  API_KEY_PREFIX,
  generateApiKey,
  generateApiSecret,
  hashApiSecret,
  maskApiKey,
  parseApiCredentials,
  verifyApiSecret,
} from './api-credential.util';

describe('api-credential.util', () => {
  it('generates unpredictable key/secret pairs and hashes the secret', () => {
    const a = generateApiKey();
    const b = generateApiKey();
    const secret = generateApiSecret();
    expect(a).toMatch(new RegExp(`^${API_KEY_PREFIX}[a-f0-9]{32}$`));
    expect(a).not.toBe(b);
    expect(secret.length).toBeGreaterThanOrEqual(32);
    const hash = hashApiSecret(secret);
    expect(hash).toHaveLength(64);
    expect(hash).not.toBe(secret);
    expect(verifyApiSecret(secret, hash)).toBe(true);
    expect(verifyApiSecret('wrong', hash)).toBe(false);
  });

  it('masks keys for listing', () => {
    const key = `${API_KEY_PREFIX}${'ab'.repeat(16)}`;
    const masked = maskApiKey(key);
    expect(masked).toContain('…');
    expect(masked).not.toBe(key);
    expect(masked.startsWith('emd_live')).toBe(true);
  });

  it('parses X-API-Key/X-API-Secret and Bearer key:secret', () => {
    const parsed = parseApiCredentials({
      apiKeyHeader: 'emd_live_abc',
      apiSecretHeader: 's3cret',
    });
    expect(parsed).toEqual({ apiKey: 'emd_live_abc', apiSecret: 's3cret' });
    const bearer = parseApiCredentials({
      authorization: 'Bearer emd_live_abc:s3cret:extra',
    });
    expect(bearer).toEqual({ apiKey: 'emd_live_abc', apiSecret: 's3cret:extra' });
    expect(parseApiCredentials({ authorization: 'Bearer not-an-api-key' })).toBeNull();
  });
});
