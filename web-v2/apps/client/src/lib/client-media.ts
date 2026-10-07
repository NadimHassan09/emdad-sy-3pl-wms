import { getClientApiBaseUrl } from '../services/apiBaseUrl';

/** Resolve a relative client media path (e.g. `/media/products/:id`) against the API base. */
export function clientMediaSrc(path: string | null | undefined, cacheKey?: string | number | null): string | null {
  if (!path) return null;
  const base = getClientApiBaseUrl().replace(/\/$/, '');
  const rel = path.startsWith('/') ? path : `/${path}`;
  const url = `${base}${rel}`;
  if (cacheKey == null || cacheKey === '') return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}v=${encodeURIComponent(String(cacheKey))}`;
}
