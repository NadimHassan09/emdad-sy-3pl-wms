# Production deployment — same-origin API (Option A)

Serve each SPA from its own hostname and **reverse-proxy API traffic on the same host** so the browser never calls `localhost` from the public site (avoids Private Network Access / loopback blocks).

## What is already in this repo

| Piece | Role |
| ----- | ---- |
| [`nginx/conf.d/00-emdad-wms-upstream.conf`](./nginx/conf.d/00-emdad-wms-upstream.conf) | `upstream emdad_wms_backend` → `127.0.0.1:3000` (Nest listens here). |
| [`nginx/snippets/emdad-wms-backend-locations.conf`](./nginx/snippets/emdad-wms-backend-locations.conf) | Proxies `/api/`, `/realtime/`, and `/socket.io/` to that upstream. |
| [`nginx/sites-available/emdad-wms-admin`](./nginx/sites-available/emdad-wms-admin) | `admin.emdadsy.com`: static files from `frontend/dist` + includes the snippet **before** the SPA `location /`. |
| [`nginx/sites-available/emdad-wms-client`](./nginx/sites-available/emdad-wms-client) | `client.emdadsy.com`: static files from `client-frontend/dist` + same snippet. |

Order matters: `include snippets/emdad-wms-backend-locations.conf` must appear **above** `location / { try_files ... }` so `/api` is handled by nginx and not by the SPA fallback.

## Checklist

1. **Nest** runs on the server (e.g. `127.0.0.1:3000`) with global prefix `/api` as in [`backend/src/main.ts`](../backend/src/main.ts).

2. **Install nginx pieces** (paths are examples; adjust to your distro layout):
   - Copy or symlink `deploy/nginx/conf.d/00-emdad-wms-upstream.conf` into nginx’s `conf.d` (or merge the `map` + `upstream` into your main config).
   - Copy `deploy/nginx/snippets/emdad-wms-backend-locations.conf` into `/etc/nginx/snippets/` (or update `include` paths in the vhosts).
   - Enable the vhost: symlink `sites-available/emdad-wms-admin` → `sites-enabled/`, same for client if used.
   - Point `ssl_certificate` / `ssl_certificate_key` at real certs (or use the `.phase1-http` variants only for HTTP testing).

3. **Build SPAs for production without** `VITE_API_URL` (or leave it unset in CI). Then:
   - **Admin** bundle uses same-origin `/api`.
   - **Client** bundle uses same-origin `/api/client`.

   ```bash
   cd frontend && npm ci && npm run build
   cd ../client-frontend && npm ci && npm run build
   ```

   Deploy `frontend/dist` and `client-frontend/dist` to the paths in the vhosts (`root` directives).

4. **Reload nginx** after config or `dist` changes:

   ```bash
   sudo nginx -t && sudo systemctl reload nginx
   ```

5. **Smoke test** from the server or your laptop:

   ```bash
   curl -sS -o /dev/null -w "%{http_code}\n" https://admin.emdadsy.com/api/companies
   ```

   Expect `401` or `200` depending on auth — not `502`/`504` (upstream down).

## Google Drive disaster recovery (off-site backups)

Off-site backup sync uses Google OAuth and the Drive API. Full setup is in [`docs/ops/BACKUP-GOOGLE-DRIVE-RUNBOOK.md`](../docs/ops/BACKUP-GOOGLE-DRIVE-RUNBOOK.md).

### Required environment variables

Set these in `backend/.env` on the server (never commit secrets):

| Variable | Purpose |
| -------- | ------- |
| `BACKUP_GDRIVE_ENABLED` | `true` to enable Drive sync |
| `BACKUP_GDRIVE_CLIENT_ID` | OAuth Web client ID from Google Cloud Console |
| `BACKUP_GDRIVE_CLIENT_SECRET` | OAuth client secret |
| `BACKUP_GDRIVE_REDIRECT_URI` | Must end with `/api/integrations/google-drive/callback` on the **admin** host |
| `BACKUP_GDRIVE_CONNECT_SUCCESS_URL` | Admin UI page after OAuth (e.g. `https://admin.emdadsy.com/settings/backups/google-drive`) |
| `BACKUP_ENCRYPTION_KEY` | 32-byte base64 key — encrypts OAuth tokens and backup files |
| `BACKUP_DEFAULT_STORAGE_POLICY` | `local_and_drive` for VPS + off-site copies |

Optional:

| Variable | Purpose |
| -------- | ------- |
| `BACKUP_GDRIVE_STARTUP_STRICT` | `false` allows boot without OAuth credentials while provisioning; defaults to strict in production |

### OAuth redirect URI

Google Cloud Console → **Credentials** → OAuth 2.0 Web client → **Authorized redirect URIs**:

```
https://staging-admin.emdadsy.com/api/integrations/google-drive/callback
```

Nginx already proxies `/api/` to Nest; no extra vhost rule is needed for the callback.

### Post-deploy verification

```bash
# Certification harness (infrastructure + API checks)
node scripts/backup-gdrive-dr-cert.mjs

# Drive integration status (requires super_admin token)
curl -s -H "Authorization: Bearer $TOKEN" -H "X-Company-Id: $COMPANY_ID" \
  http://127.0.0.1:3001/api/integrations/google-drive/status | jq .

# OAuth callback route is public (expect 400 without code/state)
curl -sS -o /dev/null -w "%{http_code}\n" \
  "https://staging-admin.emdadsy.com/api/integrations/google-drive/callback"
```

After credentials are set, connect Drive in the admin UI: **Settings → Backups → Google Drive → Connect Drive**.

See [`BACKUP-GDRIVE-DR-CERTIFICATION.md`](../BACKUP-GDRIVE-DR-CERTIFICATION.md) for the latest certification report.

## CORS

With Option A, the browser talks to `https://admin.emdadsy.com/api/...` — **same origin** as the admin UI — so you do not rely on cross-origin CORS for those calls. You may still set `CORS_ORIGINS` for local Vite dev or other tools.

## If the API must live on another host

Use a full URL at build time instead (Option B): set `VITE_API_URL` and allow that origin in `CORS_ORIGINS` on the backend.
