/**
 * Production Client Portal host only (`client.emdadsy.com`).
 * Staging (`staging-client.emdadsy.com`) and local/dev stay false so UI remains fully visible.
 */
export function isProductionClientPortal(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.hostname === 'client.emdadsy.com';
}
