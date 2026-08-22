/**
 * Survives list → detail → back remounts within the SPA session,
 * and across soft reloads via sessionStorage.
 */
const memory = new Map<string, unknown>();
const SS_PREFIX = 'wms.listUi.';

export function readListUiCache<T>(key: string): T | undefined {
  if (memory.has(key)) {
    return memory.get(key) as T;
  }
  if (typeof sessionStorage === 'undefined') return undefined;
  try {
    const raw = sessionStorage.getItem(SS_PREFIX + key);
    if (raw == null) return undefined;
    const parsed = JSON.parse(raw) as T;
    memory.set(key, parsed);
    return parsed;
  } catch {
    return undefined;
  }
}

export function writeListUiCache<T>(key: string, value: T): void {
  memory.set(key, value);
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(SS_PREFIX + key, JSON.stringify(value));
  } catch {
    /* quota / private mode */
  }
}

export function clearListUiCache(key: string): void {
  memory.delete(key);
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(SS_PREFIX + key);
  } catch {
    /* ignore */
  }
}
