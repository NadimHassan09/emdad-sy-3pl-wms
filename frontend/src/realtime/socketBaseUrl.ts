/** HTTP origin for API (strip `/api` suffix) — used for Socket.IO connection. */
export function socketHttpOrigin(): string {
  const raw = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000/api';
  try {
    const u = new URL(raw);
    return `${u.protocol}//${u.host}`;
  } catch {
    return 'http://localhost:3000';
  }
}
