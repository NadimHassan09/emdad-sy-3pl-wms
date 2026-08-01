/**
 * Admin auth storage.
 * - Access token: sessionStorage by default; localStorage when "remember me" is on (30 days).
 * - Remembered account: email + display name only (never password), Base64-encoded JSON with expiry.
 */

const ACCESS_TOKEN_KEY = 'wms.access_token';
const PERSIST_KEY = 'wms.persist_session';
const PERSIST_UNTIL_KEY = 'wms.persist_until';
const REMEMBERED_ACCOUNT_KEY = 'wms.remembered_account.v1';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export type RememberedAccount = {
  email: string;
  displayName: string;
  avatarUrl?: string | null;
};

type StoredRememberedAccount = RememberedAccount & {
  v: 1;
  expiresAt: number;
};

function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocal(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function removeLocal(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function encodePayload(data: StoredRememberedAccount): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(data))));
}

function decodePayload(raw: string): StoredRememberedAccount | null {
  try {
    const json = decodeURIComponent(escape(atob(raw)));
    const parsed = JSON.parse(json) as StoredRememberedAccount;
    if (parsed?.v !== 1 || typeof parsed.email !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

function isPersistExpired(): boolean {
  const until = readLocal(PERSIST_UNTIL_KEY);
  if (!until) return false;
  const ts = Number(until);
  return Number.isFinite(ts) && Date.now() > ts;
}

export function getAccessToken(): string | null {
  try {
    if (isPersistExpired()) {
      clearAccessToken();
      return sessionStorage.getItem(ACCESS_TOKEN_KEY);
    }
    return localStorage.getItem(ACCESS_TOKEN_KEY) ?? sessionStorage.getItem(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAccessToken(token: string | null, persist = false): void {
  try {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    removeLocal(PERSIST_KEY);
    removeLocal(PERSIST_UNTIL_KEY);
    if (!token) return;
    if (persist) {
      localStorage.setItem(ACCESS_TOKEN_KEY, token);
      writeLocal(PERSIST_KEY, '1');
      writeLocal(PERSIST_UNTIL_KEY, String(Date.now() + THIRTY_DAYS_MS));
    } else {
      sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
    }
  } catch {
    if (token) sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
  }
}

export function clearAccessToken(): void {
  try {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    removeLocal(PERSIST_KEY);
    removeLocal(PERSIST_UNTIL_KEY);
  } catch {
    /* ignore */
  }
}

export function getRememberedAccount(): RememberedAccount | null {
  const raw = readLocal(REMEMBERED_ACCOUNT_KEY);
  if (!raw) return null;
  const parsed = decodePayload(raw);
  if (!parsed) {
    removeLocal(REMEMBERED_ACCOUNT_KEY);
    return null;
  }
  if (Date.now() > parsed.expiresAt) {
    removeLocal(REMEMBERED_ACCOUNT_KEY);
    return null;
  }
  return {
    email: parsed.email.trim(),
    displayName: (parsed.displayName || parsed.email).trim(),
    avatarUrl: parsed.avatarUrl ?? null,
  };
}

export function setRememberedAccount(account: RememberedAccount | null): void {
  if (!account?.email.trim()) {
    removeLocal(REMEMBERED_ACCOUNT_KEY);
    return;
  }
  const payload: StoredRememberedAccount = {
    v: 1,
    email: account.email.trim().toLowerCase(),
    displayName: (account.displayName || account.email).trim(),
    avatarUrl: account.avatarUrl ?? null,
    expiresAt: Date.now() + THIRTY_DAYS_MS,
  };
  writeLocal(REMEMBERED_ACCOUNT_KEY, encodePayload(payload));
}

export function clearRememberedAccount(): void {
  removeLocal(REMEMBERED_ACCOUNT_KEY);
}
