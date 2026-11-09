import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  fetchUsdToSypFromCustomApi,
  normalizeCustomRate,
  readFxCustomConfig,
  readJsonPath,
  setFxCustomConfigPathForTests,
  toPublicFxCustomConfig,
  writeFxCustomConfig,
} from './fx-custom-config';

describe('fx-custom-config', () => {
  const dir = mkdtempSync(join(tmpdir(), 'fx-custom-'));
  const path = join(dir, 'shipping-fx-custom.json');

  beforeAll(() => setFxCustomConfigPathForTests(path));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('reads a dotted JSON path', () => {
    expect(readJsonPath({ usd: { syp: 13000 } }, 'usd.syp')).toBe(13000);
    expect(readJsonPath({ data: { rates: { SYP: 140 } } }, 'data.rates.SYP')).toBe(140);
    expect(readJsonPath({}, 'usd.syp')).toBeUndefined();
  });

  it('normalizes new SYP to old SYP', () => {
    expect(normalizeCustomRate(130, 'new_syp')).toBe(13000);
    expect(normalizeCustomRate(13000, 'old_syp')).toBe(13000);
  });

  it('persists config and never exposes the auth secret publicly', () => {
    writeFxCustomConfig({
      enabled: true,
      url: 'https://example.com/fx.json',
      jsonPath: 'usd.syp',
      rateUnit: 'old_syp',
      authHeaderName: 'Authorization',
      authHeaderValue: 'Bearer secret-token',
    });
    const cfg = readFxCustomConfig();
    expect(cfg.authHeaderValue).toBe('Bearer secret-token');
    const pub = toPublicFxCustomConfig(cfg);
    expect(pub.authConfigured).toBe(true);
    expect(pub).not.toHaveProperty('authHeaderValue');
  });

  it('fetches and extracts a custom rate over HTTPS', async () => {
    const fetchImpl = (async () =>
      ({
        ok: true,
        json: async () => ({ market: { syp_per_usd: 125.5 } }),
      })) as unknown as typeof fetch;
    const result = await fetchUsdToSypFromCustomApi(
      {
        url: 'https://example.com/rate',
        jsonPath: 'market.syp_per_usd',
        rateUnit: 'new_syp',
      },
      fetchImpl,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rate).toBe(12550);
      expect(result.source).toBe('custom-api');
    }
  });

  it('rejects non-HTTPS URLs', async () => {
    const result = await fetchUsdToSypFromCustomApi({
      url: 'http://insecure.example/fx',
      jsonPath: 'usd.syp',
      rateUnit: 'old_syp',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/HTTPS/i);
  });
});
