const BEARER_KEY = 'client_portal_access_token';
const PERSIST_KEY = 'client_portal_persist_session';
const PERSIST_UNTIL_KEY = 'client_portal_persist_until';
const REMEMBER_EMAIL_KEY = 'client_portal_remember_email';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

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

export function getRememberedEmail(): string {
  return readLocal(REMEMBER_EMAIL_KEY) ?? '';
}

export function setRememberedEmail(email: string | null): void {
  if (email?.trim()) {
    writeLocal(REMEMBER_EMAIL_KEY, email.trim());
  } else {
    removeLocal(REMEMBER_EMAIL_KEY);
  }
}
