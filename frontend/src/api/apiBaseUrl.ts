/**
 * Axios base URL for the internal admin app.
 *
 * - Local dev: set `VITE_API_URL=/api` and use Vite proxy (`VITE_DEV_BACKEND_URL`, default `http://127.0.0.1:3000`).
 * - Or set `VITE_API_URL=http://localhost:3000/api` to call Nest directly (CORS must allow the Vite origin).
 * - Production: `/api` on same host or an absolute API URL.
 */
export function getApiBaseUrl(): string {
  const fromEnv = (import.meta.env.VITE_API_URL as string | undefined)?.trim().replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  if (import.meta.env.PROD) return '/api';
  return '/api';
}
