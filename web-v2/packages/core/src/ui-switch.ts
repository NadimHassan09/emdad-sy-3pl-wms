/**
 * Rollout switch between the classic UI (v1) and this UI (v2).
 * The web server chooses the document root from the `emdad_ui` cookie; the apps only
 * flip the cookie and reload. No code from the classic UI is involved.
 */
export type UiVersion = 'v1' | 'v2'
const COOKIE = 'emdad_ui'

export function getUiVersion(): UiVersion | null {
  if (typeof document === 'undefined') return null
  const m = document.cookie.match(new RegExp(`(?:^|; )${COOKIE}=(v1|v2)`))
  return (m?.[1] as UiVersion | undefined) ?? null
}

export function setUiVersion(v: UiVersion, days = 180): void {
  document.cookie = `${COOKIE}=${v}; path=/; max-age=${days * 86400}; SameSite=Lax`
}

export function switchUiAndReload(v: UiVersion): void {
  setUiVersion(v)
  window.location.reload()
}
