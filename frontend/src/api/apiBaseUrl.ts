/**
 * Axios base URL for the internal admin app.
 *
 * - Set `VITE_API_URL` at build time for a dedicated API host, e.g. `https://api.example.com/api`.
 * - If unset in production, uses `/api` (same origin as the admin UI — configure the host to proxy `/api` → backend).
 * - Local dev default: `http://localhost:3000/api`.
 */
export function getApiBaseUrl(): string {
  const fromEnv = (import.meta.env.VITE_API_URL as string | undefined)?.trim().replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  if (import.meta.env.PROD) return '/api';
  return 'http://localhost:3000/api';
}
