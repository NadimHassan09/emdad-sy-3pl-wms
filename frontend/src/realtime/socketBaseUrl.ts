import { getApiBaseUrl } from '../api/apiBaseUrl';

/** HTTP origin for API — used for Socket.IO connection. */
export function socketHttpOrigin(): string {
  const raw = getApiBaseUrl();
  const fallbackOrigin =
    typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  try {
    const u = new URL(raw, fallbackOrigin);
    return `${u.protocol}//${u.host}`;
  } catch {
    return fallbackOrigin;
  }
}
