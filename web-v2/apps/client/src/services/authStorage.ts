const BEARER_KEY = 'client_portal_access_token';
const PERSIST_KEY = 'client_portal_persist_session';
const PERSIST_UNTIL_KEY = 'client_portal_persist_until';
const REMEMBER_EMAIL_KEY = 'client_portal_remember_email';
const REMEMBERED_ACCOUNT_KEY = 'client_portal_remembered_account.v1';

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
    // ignore storage failures
  }
}

function removeLocal(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore storage failures
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

export function getStoredBearer(): string | null {
  try {
    if (isPersistExpired()) {
      clearStoredBearer();
      return sessionStorage.getItem(BEARER_KEY);
    }
    return localStorage.getItem(BEARER_KEY) ?? sessionStorage.getItem(BEARER_KEY);
  } catch {
    return null;
  }
}

export function setStoredBearer(token: string, persist = false): void {
  try {
    sessionStorage.removeItem(BEARER_KEY);
    localStorage.removeItem(BEARER_KEY);
    removeLocal(PERSIST_KEY);
    removeLocal(PERSIST_UNTIL_KEY);
    if (persist) {
      localStorage.setItem(BEARER_KEY, token);
      writeLocal(PERSIST_KEY, '1');
      writeLocal(PERSIST_UNTIL_KEY, String(Date.now() + THIRTY_DAYS_MS));
    } else {
      sessionStorage.setItem(BEARER_KEY, token);
    }
  } catch {
    sessionStorage.setItem(BEARER_KEY, token);
  }
}

export function clearStoredBearer(): void {
  try {
    sessionStorage.removeItem(BEARER_KEY);
    localStorage.removeItem(BEARER_KEY);
    removeLocal(PERSIST_KEY);
    removeLocal(PERSIST_UNTIL_KEY);
  } catch {
    // ignore storage failures
  }
}

/** @deprecated Prefer getRememberedAccount — kept for migration. */
export function getRememberedEmail(): string {
  return getRememberedAccount()?.email ?? readLocal(REMEMBER_EMAIL_KEY) ?? '';
}

/** @deprecated Prefer setRememberedAccount. */
export function setRememberedEmail(email: string | null): void {
  if (email?.trim()) {
    setRememberedAccount({ email: email.trim(), displayName: email.trim() });
  } else {
    clearRememberedAccount();
  }
}

export function getRememberedAccount(): RememberedAccount | null {
  const raw = readLocal(REMEMBERED_ACCOUNT_KEY);
  if (raw) {
    const parsed = decodePayload(raw);
    if (!parsed || Date.now() > parsed.expiresAt) {
      removeLocal(REMEMBERED_ACCOUNT_KEY);
    } else {
      return {
        email: parsed.email.trim(),
        displayName: (parsed.displayName || parsed.email).trim(),
        avatarUrl: parsed.avatarUrl ?? null,
      };
    }
  }

  // Migrate legacy email-only key.
  const legacy = readLocal(REMEMBER_EMAIL_KEY);
  if (legacy?.trim()) {
    return { email: legacy.trim(), displayName: legacy.trim() };
  }
  return null;
}

export function setRememberedAccount(account: RememberedAccount | null): void {
  removeLocal(REMEMBER_EMAIL_KEY);
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
  removeLocal(REMEMBER_EMAIL_KEY);
}
