import { getClientApiBaseUrl } from '../services/apiBaseUrl';

export function socketHttpOrigin(): string {
  const apiBase = getClientApiBaseUrl();
  if (apiBase.startsWith('/')) {
    return typeof window !== 'undefined' ? window.location.origin : '';
  }
  try {
    const u = new URL(apiBase);
    return `${u.protocol}//${u.host}`;
  } catch {
    return typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  }
}
