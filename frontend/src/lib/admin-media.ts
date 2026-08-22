/** Resolve a relative media path (e.g. `/media/avatars/:id/...`) for `<img src>`. */
export function adminMediaSrc(
  path: string | null | undefined,
  cacheKey?: string | number | null,
): string | null {
  if (!path?.trim()) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const cleaned = path.trim().replace(/^\/media\//, '').replace(/^\/+/, '');
  const url = `/api/client/media/${cleaned}`;
  if (cacheKey == null || cacheKey === '') return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}v=${encodeURIComponent(String(cacheKey))}`;
}
