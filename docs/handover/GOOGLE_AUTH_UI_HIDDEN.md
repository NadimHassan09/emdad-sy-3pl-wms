# Google Auth / Sheets / SMTP UI — hidden until verification

**Date:** 14 Nov 2026  
**Scope:** Frontend + client-portal UI only. Backend APIs, OAuth services, password-reset, and Sheets Google sync remain implemented.

## Why

Google Cloud OAuth app for `emdadsy.com` is still in **Testing** (403 `access_denied` for non–test users). Publishing can take days–months. Until the client completes verification (or another engineer enables it), end users must not see Google buttons that lead to that error.

SMTP-backed flows (forgot password / email reset codes) are also unavailable without a working mail path, so those links are hidden with the same flag.

## Flag

```env
# admin frontend/.env and client-frontend/.env (or build env)
GOOGLE_AUTH_UI_ENABLED=false   # default — hidden
GOOGLE_AUTH_UI_ENABLED=true    # restore all Google + forgot-password UI
```

Injected via Vite `define` as `__GOOGLE_AUTH_UI_ENABLED__`, read by `isGoogleAuthUiEnabled()`:

- `frontend/src/lib/google-auth-ui.ts`
- `client-frontend/src/lib/google-auth-ui.ts`

## Hidden surfaces (flag = false)

| Surface | App |
|---------|-----|
| Login “Sign in with Google” | Admin + Client |
| Login “Forgot password?” + reset modal | Admin + Client |
| Profile Link/Unlink Google | Admin + Client |
| Settings tab “Google OAuth” + `/backups/google-oauth-settings` | Admin (redirects to `/backups`) |
| Sheets “Connect with Google” / “Open in Google Sheets” panel | Client |

Google Drive backup UI remains under the separate flag `BACKUP_GDRIVE_UI_ENABLED` (already default false).

## Handoff note for next engineer

1. Complete Google Cloud verification / add Test users, or publish the app.
2. Configure SMTP if email reset is required.
3. Set `GOOGLE_AUTH_UI_ENABLED=true` on both frontends and rebuild.
4. Re-test O-13 (Sheets) + O-16/O-17 (Google link + forgot password).

Code was **not deleted** — only gated.
