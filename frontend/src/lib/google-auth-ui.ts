/**
 * Frontend-only flag for Google OAuth / Sheets / SMTP-dependent auth UI.
 * Backend APIs remain intact. Default OFF until Google Cloud verification + SMTP are ready.
 *
 * Env: GOOGLE_AUTH_UI_ENABLED=true restores prior UI (login, profile link, OAuth settings,
 * forgot-password / email reset).
 */
declare const __GOOGLE_AUTH_UI_ENABLED__: string | undefined;

function parseFlag(value: string | undefined): boolean {
  if (value == null || value === '') return false;
  const normalized = value.trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

export function isGoogleAuthUiEnabled(): boolean {
  return parseFlag(__GOOGLE_AUTH_UI_ENABLED__);
}
