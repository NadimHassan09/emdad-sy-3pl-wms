/**
 * Axios base URL for the client portal.
 *
 * - Set `VITE_API_URL` at build time when the API lives elsewhere, e.g. `https://api.example.com/api/client`.
 * - If unset in production, uses `/api/client` (same origin — proxy that path to the backend).
 * - Local dev default: `http://localhost:3000/api/client`.
 */
export function getClientApiBaseUrl(): string {
  const fromEnv = (import.meta.env.VITE_API_URL as string | undefined)?.trim().replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  if (import.meta.env.PROD) return '/api/client';
  return 'http://localhost:3000/api/client';
}
