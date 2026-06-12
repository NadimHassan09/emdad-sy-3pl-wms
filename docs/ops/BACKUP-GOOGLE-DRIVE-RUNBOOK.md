# Google Drive Backup — Operations Runbook

**Scope:** EMDAD WMS staging/production off-site disaster recovery via Google Drive  
**Related reports:** [BACKUP-6A-REPORT.md](../../BACKUP-6A-REPORT.md), [BACKUP-6B-REPORT.md](../../BACKUP-6B-REPORT.md), [BACKUP-6C-REPORT.md](../../BACKUP-6C-REPORT.md)

---

## 1. Prerequisites

| Requirement | Notes |
|-------------|-------|
| `super_admin` account | Only role that can connect/disconnect Drive |
| `BACKUP_ENCRYPTION_KEY` | 32-byte base64 (`openssl rand -base64 32`) — encrypts OAuth tokens and `.dump.enc` |
| Google Cloud project | OAuth 2.0 Web client with Drive API enabled |
| VPS disk path | `BACKUP_STORAGE_PATH` (default `/var/lib/emdad-wms/backups/<env>`) |

---

## 2. Google Cloud OAuth Setup

1. Open [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials**.
2. Enable **Google Drive API** for the project.
3. Create **OAuth 2.0 Client ID** → type **Web application**.
4. Add **Authorized redirect URI** (must match exactly):

   ```
   https://staging-admin.emdadsy.com/api/integrations/google-drive/callback
   ```

   Production: replace host with production admin URL.

5. Copy **Client ID** and **Client secret**.

---

## 3. Staging Environment Variables

Edit `backend/.env` (do **not** commit secrets):

```env
BACKUP_GDRIVE_ENABLED=true
BACKUP_GDRIVE_CLIENT_ID=<your-client-id>.apps.googleusercontent.com
BACKUP_GDRIVE_CLIENT_SECRET=<your-client-secret>
BACKUP_GDRIVE_REDIRECT_URI=https://staging-admin.emdadsy.com/api/integrations/google-drive/callback
BACKUP_GDRIVE_ROOT_FOLDER_NAME=EMDAD WMS Backups
BACKUP_GDRIVE_CONNECT_SUCCESS_URL=https://staging-admin.emdadsy.com/settings/backups/google-drive
BACKUP_ENCRYPTION_KEY=<existing-32-byte-base64-key>
BACKUP_DEFAULT_STORAGE_POLICY=local_and_drive

# Retry worker (BACKUP-6B)
BACKUP_GDRIVE_RETRY_MAX_ATTEMPTS=8
BACKUP_GDRIVE_RETRY_BASE_SEC=60
BACKUP_GDRIVE_RETRY_MAX_SEC=21600

# Drive retention (independent from local retention)
BACKUP_GDRIVE_RETENTION_CLEANUP_ENABLED=true
BACKUP_GDRIVE_KEEP_LAST_DAILY=14
BACKUP_GDRIVE_KEEP_LAST_WEEKLY=8
BACKUP_GDRIVE_KEEP_LAST_MONTHLY=24
```

Restart backend:

```bash
cd backend && npm run build
pm2 restart emdad-wms-backend-staging --update-env
```

**Startup validation:** When `BACKUP_GDRIVE_ENABLED=true`, the backend validates OAuth credentials on boot. In production this is strict by default and will refuse to start if `BACKUP_GDRIVE_CLIENT_ID/SECRET` are missing. While provisioning credentials, set:

```env
BACKUP_GDRIVE_STARTUP_STRICT=false
```

Remove or set to `true` once OAuth credentials are configured.

Verify:

```bash
node scripts/backup-gdrive-dr-cert.mjs

curl -s -H "Authorization: Bearer $TOKEN" -H "X-Company-Id: $COMPANY_ID" \
  http://127.0.0.1:3001/api/integrations/google-drive/status | jq .
# Expect: gdriveConfigured=true, gdriveEnabled=true
```

---

## 4. Connect Google Drive (UI)

1. Log in as `super_admin`.
2. Navigate to **Settings → Backups → Google Drive**.
3. Click **Connect Drive** → complete Google consent (`prompt=consent` ensures refresh token).
4. Browser redirects to `…/google-drive?drive=connected` with success toast.
5. Click **Test connection** — expect folder name `EMDAD WMS Backups`.
6. Confirm audit event `backup.drive.connected` in backup audit panel.

**Folder layout created automatically:**

```
/EMDAD WMS Backups/
  └── {BACKUP_ENV_ID}/
        └── {YYYY-MM}/
              └── {jobId}.dump.enc
```

Only **encrypted** `.dump.enc` files are uploaded — plain `.dump` never leaves the VPS (except during restore download).

---

## 5. Storage Policies

| Policy | Local dump | Drive sync | After successful sync |
|--------|-----------|------------|----------------------|
| `local_only` | Yes | No | — |
| `local_and_drive` | Yes | Yes (async) | Local kept |
| `drive_only` | Yes (temp) | Yes | Local purged |

Set default policy on **Google Drive** settings page or via API:

```bash
PUT /api/backups/storage-policy
{ "defaultPolicy": "local_and_drive" }
```

Drive policies require `BACKUP_GDRIVE_ENABLED=true` **and** a connected Drive account.

Per-schedule override: `backup_schedules.storage_policy` (nullable).

---

## 6. Disconnect Google Drive

1. **Settings → Backups → Google Drive → Disconnect Drive**.
2. Confirm modal — encrypted OAuth credentials are deleted from `backup_drive_integrations`.
3. Existing Drive files are **not** deleted.
4. Audit event: `backup.drive.disconnected`.

After disconnect, drive policies cannot be saved until reconnected. Runtime falls back to `local_only`.

---

## 7. Upload Failures & Retry

The retry worker runs every **2 minutes** (`BackupDriveRetryService`).

| Env var | Default | Purpose |
|---------|---------|---------|
| `BACKUP_GDRIVE_RETRY_MAX_ATTEMPTS` | 8 | Stop after N attempts |
| `BACKUP_GDRIVE_RETRY_BASE_SEC` | 60 | Exponential backoff base |
| `BACKUP_GDRIVE_RETRY_MAX_SEC` | 21600 | Backoff cap (6 h) |

**Manual retry:** Google Drive page → **Backup sync failures** table → **Retry sync**.

**Audit events:**

- `backup.drive.retry_scheduled` — failure with next retry time
- `backup.drive.retry_attempted` — cron or manual retry
- `backup.drive.upload_failed` — max attempts exhausted

### Certifying retry (staging only)

```bash
# Temporarily add to backend/.env:
BACKUP_GDRIVE_SIMULATE_UPLOAD_FAILURE=true
pm2 restart emdad-wms-backend-staging --update-env

# Trigger sync-drive on a completed backup, verify gdrive_sync_status=failed
# Remove simulate flag and restart — retry worker should recover
```

---

## 8. Drive Retention

Independent from local retention (`BACKUP_KEEP_LAST_*`).

**API (no UI yet):**

```bash
GET  /api/backups/retention/drive/policies
GET  /api/backups/retention/drive/preview
POST /api/backups/retention/drive/cleanup   # super_admin only
```

Cron: daily **05:30** (after local retention at 05:15).

| Policy on job | On Drive retention delete |
|---------------|----------------------------|
| `local_and_drive` | Delete Drive file; clear `gdrive_*` fields; keep local dump |
| `drive_only` | Delete Drive file **and** `backup_jobs` row |

Audit: `backup.drive.deleted`, `backup.drive.retention.cleanup`.

---

## 9. Restore from Drive-Backed Backup

Restore supports Drive when local dump is missing but `gdrive_sync_status=synced` and `gdrive_file_id` is set:

1. Download `.dump.enc` from Google Drive.
2. Decrypt to temporary local `.dump`.
3. Run standard `pg_restore` pipeline.
4. Delete temporary files after restore.

**Requirements:** Drive must be connected with valid refresh token; `BACKUP_ENCRYPTION_KEY` must match the key used at upload time.

**Session invalidation:** All user sessions are invalidated after restore — users must re-login.

---

## 10. Certification Commands

```bash
# API certification harness
node scripts/backup-6c-cert.mjs

# Playwright E2E (staging UI)
cd frontend
BASE_URL=https://staging-admin.emdadsy.com npx playwright test e2e/backup-google-drive.spec.ts
BASE_URL=https://staging-admin.emdadsy.com npx playwright test e2e/backup-*.spec.ts

# UI screenshots
node scripts/capture-backup-6c-screenshots.mjs

# Build verification
cd backend && npm run build
cd ../frontend && npm run build
```

Evidence output: `docs/evidence/backup-6c/`

---

## 11. Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Connect button disabled | OAuth env vars missing | Set `BACKUP_GDRIVE_CLIENT_ID/SECRET`, restart PM2 |
| `auth-url` returns 503 | `gdriveConfigured()` false | Check all four: ENABLED + CLIENT_ID + SECRET + REDIRECT_URI |
| No refresh token on connect | Re-auth without consent | Disconnect and reconnect; OAuth uses `prompt=consent` |
| Upload fails immediately | Missing encryption key | Set `BACKUP_ENCRYPTION_KEY` (32-byte base64) |
| Restore fails "missing on disk" | `drive_only` without Drive sync | Verify `gdrive_file_id` and Drive connection |
| Policy PUT returns 400 | Drive not connected | Connect Drive before setting `local_and_drive` / `drive_only` |
| Sync stuck pending | Drive disabled at runtime | Confirm `BACKUP_GDRIVE_ENABLED=true` after PM2 restart |
| Backend fails on boot | OAuth env missing with strict startup | Set credentials or `BACKUP_GDRIVE_STARTUP_STRICT=false` during provisioning |
| Health shows `gdrive_not_configured` | CLIENT_ID/SECRET unset | Complete Google Cloud OAuth setup (section 2) |

---

## 12. Security Notes

- OAuth refresh tokens stored as AES-256-GCM ciphertext (`v1:…` prefix) in `backup_drive_integrations`.
- Scope: `https://www.googleapis.com/auth/drive.file` (app-created files only).
- OAuth `state` parameter is HMAC-signed with 10-minute TTL.
- Never commit `.env` with client secrets or encryption keys.

---

## 13. Certification

Run the automated DR certification harness after deploy:

```bash
node scripts/backup-gdrive-dr-cert.mjs          # infrastructure + API checks
node scripts/backup-gdrive-e2e-cert.mjs           # full E2E (upload, retry, retention, restore)
SKIP_RESTORE=1 node scripts/backup-gdrive-e2e-cert.mjs   # non-destructive E2E
npm run cert:gdrive:e2e
```

Evidence: `docs/evidence/backup-gdrive-dr/` (infra), `docs/evidence/backup-gdrive-e2e/` (E2E)  
Reports: [`BACKUP-GDRIVE-DR-CERTIFICATION.md`](../../BACKUP-GDRIVE-DR-CERTIFICATION.md), [`BACKUP-GDRIVE-E2E-CERTIFICATION.md`](../../BACKUP-GDRIVE-E2E-CERTIFICATION.md)

---

*Last updated: BACKUP-GDRIVE-DR certification (2026-06-11)*
