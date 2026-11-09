import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * Admin-configured external FX API (USD→SYP).
 * Stored on disk so we do not need a DB migration for custom URL / JSON path / auth.
 * Auth header value never leaves this module in API responses.
 */
export type FxCustomConfig = {
  enabled: boolean;
  url: string;
  /** Dot path into the JSON body, e.g. "usd.syp" or "data.rates.SYP". */
  jsonPath: string;
  /** How the numeric rate is denominated before we store it (platform uses old SYP). */
  rateUnit: 'old_syp' | 'new_syp';
  authHeaderName: string | null;
  authHeaderValue: string | null;
};

export type FxCustomConfigPublic = {
  enabled: boolean;
  url: string;
  jsonPath: string;
  rateUnit: 'old_syp' | 'new_syp';
  authHeaderName: string | null;
  /** True when a secret header value is stored — never echoed. */
  authConfigured: boolean;
};

export const FX_CUSTOM_SOURCE_LABEL = 'custom-api';
const OLD_PER_NEW = 100;

const DEFAULT_CONFIG: FxCustomConfig = {
  enabled: false,
  url: '',
  jsonPath: 'usd.syp',
  rateUnit: 'old_syp',
  authHeaderName: null,
  authHeaderValue: null,
};

/** Overridable in unit tests. */
export let fxCustomConfigPath = join(
  process.cwd(),
  'storage',
  'config',
  'shipping-fx-custom.json',
);

export function setFxCustomConfigPathForTests(path: string) {
  fxCustomConfigPath = path;
}

export function readFxCustomConfig(): FxCustomConfig {
  try {
    if (!existsSync(fxCustomConfigPath)) return { ...DEFAULT_CONFIG };
    const raw = JSON.parse(readFileSync(fxCustomConfigPath, 'utf8')) as Partial<FxCustomConfig>;
    return {
      enabled: Boolean(raw.enabled),
      url: typeof raw.url === 'string' ? raw.url.trim() : '',
      jsonPath:
        typeof raw.jsonPath === 'string' && raw.jsonPath.trim()
          ? raw.jsonPath.trim()
          : DEFAULT_CONFIG.jsonPath,
      rateUnit: raw.rateUnit === 'new_syp' ? 'new_syp' : 'old_syp',
      authHeaderName:
        typeof raw.authHeaderName === 'string' && raw.authHeaderName.trim()
          ? raw.authHeaderName.trim()
          : null,
      authHeaderValue:
        typeof raw.authHeaderValue === 'string' && raw.authHeaderValue.trim()
          ? raw.authHeaderValue
          : null,
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function toPublicFxCustomConfig(cfg: FxCustomConfig): FxCustomConfigPublic {
  return {
    enabled: cfg.enabled,
    url: cfg.url,
    jsonPath: cfg.jsonPath,
    rateUnit: cfg.rateUnit,
    authHeaderName: cfg.authHeaderName,
    authConfigured: Boolean(cfg.authHeaderValue),
  };
}

export function writeFxCustomConfig(next: FxCustomConfig): void {
  const dir = dirname(fxCustomConfigPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(fxCustomConfigPath, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
}

/** Walk a dotted path; supports simple keys only (no brackets). */
export function readJsonPath(body: unknown, path: string): unknown {
  const parts = path
    .split('.')
    .map((p) => p.trim())
    .filter(Boolean);
  let cur: unknown = body;
  for (const part of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

export function normalizeCustomRate(raw: number, unit: 'old_syp' | 'new_syp'): number {
  const n = unit === 'new_syp' ? raw * OLD_PER_NEW : raw;
  return n;
}

export type FxCustomFetchInput = {
  url: string;
  jsonPath: string;
  rateUnit: 'old_syp' | 'new_syp';
  authHeaderName?: string | null;
  authHeaderValue?: string | null;
};

export async function fetchUsdToSypFromCustomApi(
  input: FxCustomFetchInput,
  fetchImpl: typeof fetch = fetch,
  now: Date = new Date(),
): Promise<
  | { ok: true; rate: number; source: string; fetchedAt: string }
  | { ok: false; source: string; error: string }
> {
  const url = input.url?.trim() ?? '';
  if (!url) {
    return { ok: false, source: FX_CUSTOM_SOURCE_LABEL, error: 'Custom FX URL is empty.' };
  }
  if (!/^https:\/\//i.test(url)) {
    return {
      ok: false,
      source: FX_CUSTOM_SOURCE_LABEL,
      error: 'Custom FX URL must use HTTPS.',
    };
  }
  const jsonPath = input.jsonPath?.trim() || 'usd.syp';
  try {
    const headers: Record<string, string> = { Accept: 'application/json' };
    const name = input.authHeaderName?.trim();
    const value = input.authHeaderValue?.trim();
    if (name && value) headers[name] = value;

    const res = await fetchImpl(url, { headers });
    if (!res.ok) {
      return {
        ok: false,
        source: FX_CUSTOM_SOURCE_LABEL,
        error: `HTTP ${res.status} from custom FX URL`,
      };
    }
    const body = await res.json();
    const leaf = readJsonPath(body, jsonPath);
    const raw = Number(leaf);
    if (!Number.isFinite(raw) || raw <= 0) {
      return {
        ok: false,
        source: FX_CUSTOM_SOURCE_LABEL,
        error: `No positive rate at JSON path "${jsonPath}".`,
      };
    }
    const rate = normalizeCustomRate(raw, input.rateUnit);
    if (!Number.isFinite(rate) || rate <= 0) {
      return {
        ok: false,
        source: FX_CUSTOM_SOURCE_LABEL,
        error: 'Custom FX rate normalized to a non-positive number.',
      };
    }
    return {
      ok: true,
      rate,
      source: FX_CUSTOM_SOURCE_LABEL,
      fetchedAt: now.toISOString(),
    };
  } catch (err) {
    return {
      ok: false,
      source: FX_CUSTOM_SOURCE_LABEL,
      error: err instanceof Error ? err.message : 'Custom FX source unreachable',
    };
  }
}
