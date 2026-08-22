# Google Sign-In (linked accounts only)

Google OAuth is an **additional** authentication method for existing admin users.
It never creates accounts and never auto-links by email.

## Flow

1. Admin creates the user (existing Users UI).
2. User signs in with email/password.
3. User opens **Profile → Link Google** (authenticated OAuth).
4. Afterwards they may use **Sign in with Google** or password.

Unlinked Google accounts are rejected with:
`This Google account is not linked to an existing account. Please contact your administrator.`

Identity is stored as Google `sub` (`users.google_sub`), not email alone.

## Enable on staging

1. Create an OAuth 2.0 Web client in Google Cloud Console.
2. Authorized redirect URI:
   `https://staging-admin.emdadsy.com/api/auth/google/callback`
3. Set in `backend/.env`:

```bash
GOOGLE_OAUTH_ENABLED=true
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
GOOGLE_OAUTH_REDIRECT_URI=https://staging-admin.emdadsy.com/api/auth/google/callback
GOOGLE_OAUTH_FRONTEND_ORIGIN=https://staging-admin.emdadsy.com
GOOGLE_OAUTH_SUCCESS_URL=https://staging-admin.emdadsy.com/login
GOOGLE_OAUTH_FAILURE_URL=https://staging-admin.emdadsy.com/login
GOOGLE_OAUTH_LINK_SUCCESS_URL=https://staging-admin.emdadsy.com/profile
```

4. Restart: `pm2 restart emdad-wms-backend-staging --update-env`

Until enabled, `/api/auth/google/status` returns `{ "enabled": false }` and the UI hides Google controls.

## Audit actions

- `AUTH_GOOGLE_LINKED`
- `AUTH_GOOGLE_UNLINKED`
- `AUTH_GOOGLE_LOGIN_SUCCESS`
- `AUTH_GOOGLE_LOGIN_FAILED`
- `AUTH_GOOGLE_LOGIN_REJECTED_NOT_LINKED`
- `AUTH_GOOGLE_LINK_FAILED`
