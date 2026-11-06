# RELEASE-R4 — Backup Disaster Recovery Certification

**Generated:** 2026-06-06  
**Environment:** Staging (`wms_db_staging`, `https://staging-admin.emdadsy.com`)  
**Executor:** Automated API harness (`scripts/release-r4-dr-cert.mjs`) + Playwright UI capture  
**Evidence bundle:** [`docs/evidence/release-r4-dr/`](docs/evidence/release-r4-dr/)  
**Deliverable:** This file only

---

## Executive Summary

RELEASE-R4 certifies backup disaster recovery on **staging** with Google Drive integration **enabled at the environment layer**. Local backup, restore, entity integrity, storage-policy APIs, retention preview/cleanup, and exponential retry math were validated end-to-end. **Live Google Drive OAuth, upload sync, forced-failure retries, and Drive retention against real files remain blocked** because `BACKUP_GDRIVE_CLIENT_ID` / `BACKUP_GDRIVE_CLIENT_SECRET` are not configured on the server.

| Metric | Value |
|--------|-------|
| **Recovery Time Objective (RTO)** | **9 s** (restore job wall time) |
| **Recovery Point Objective (RPO)** | **~12 s** (time from backup completion to restore start) |
| **Raw readiness score** | **77 / 100** |
| **Corrected readiness score** | **85 / 100** (retention cleanup HTTP 201 counted as pass; see §5) |
| **Classification** | **Partial DR certification — local DR ready; off-site Drive pending ops** |

### Phase scorecard

| Phase | Result | Notes |
|-------|--------|-------|
| 1. Configuration | **PARTIAL** | `BACKUP_GDRIVE_ENABLED=true`, encryption key, redirect/success URLs set; OAuth client missing |
| 2. Google Drive integration | **BLOCKED** | Connect / reconnect / test require OAuth; disconnect API OK |
| 3. Storage policies | **PASS** | `local_only`, `local_and_drive`, `drive_only` all accepted via API |
| 4. Retry engine | **PARTIAL** | Backoff math verified; forced upload failure blocked (Drive not connected) |
| 5. Retention | **PASS** | Local + Drive preview/cleanup APIs succeed (0 deletions — nothing expired) |
| 6. Disaster recovery | **PASS** | Full restore; all entity counts match baseline |

**Staging DR verdict:** **Local disaster recovery is certified.** Off-site Google Drive DR cannot be signed off until OAuth credentials are provisioned, Drive is connected in the admin UI, and upload + retry + Drive retention are re-run.

---

## 1. Test Environment

| Item | Value |
|------|-------|
| API (direct) | `http://127.0.0.1:3001/api` |
| Admin UI | `https://staging-admin.emdadsy.com` |
| Storage path | `/var/lib/emdad-wms/backups/staging` |
| `BACKUP_ENV_ID` | `staging` |
| Actor | `superadmin@emdad.example` (super_admin) |
| Company ID | `00000000-0000-4000-8000-000000000001` |
| PM2 process | `emdad-wms-backend-staging` |
| Harness | `scripts/release-r4-dr-cert.mjs` |
| Screenshots | `scripts/release-r4-dr-screenshots.mjs` |

---

## 2. Configuration (Phase 1)

### Required environment variables

| Variable | Required | Staging value | Status |
|----------|----------|---------------|--------|
| `BACKUP_GDRIVE_ENABLED` | `true` | `true` | **PASS** |
| `BACKUP_GDRIVE_CLIENT_ID` | OAuth client | *(unset)* | **BLOCKED** |
| `BACKUP_GDRIVE_CLIENT_SECRET` | OAuth client | *(unset)* | **BLOCKED** |
| `BACKUP_ENCRYPTION_KEY` | 32-byte base64 | `[set]` | **PASS** |
| `BACKUP_GDRIVE_CONNECT_SUCCESS_URL` | post-OAuth redirect | `https://staging-admin.emdadsy.com/settings/backups/google-drive` | **PASS** |
| `BACKUP_GDRIVE_REDIRECT_URI` | OAuth callback | `https://staging-admin.emdadsy.com/api/integrations/google-drive/callback` | **PASS** |
| `BACKUP_DEFAULT_STORAGE_POLICY` | — | `local_and_drive` | **PASS** |

Evidence: [`docs/evidence/release-r4-dr/00-config.json`](docs/evidence/release-r4-dr/00-config.json)

### Retry / retention tuning (also configured)

```
BACKUP_GDRIVE_RETRY_MAX_ATTEMPTS=8
BACKUP_GDRIVE_RETRY_BASE_SEC=60
BACKUP_GDRIVE_RETRY_MAX_SEC=21600
BACKUP_GDRIVE_RETENTION_CLEANUP_ENABLED=true
BACKUP_GDRIVE_KEEP_LAST_DAILY=14
BACKUP_GDRIVE_KEEP_LAST_WEEKLY=8
BACKUP_GDRIVE_KEEP_LAST_MONTHLY=24
```

### Ops remediation (Drive unblock)

1. Create Google Cloud OAuth 2.0 client (Web application) with authorized redirect URI matching `BACKUP_GDRIVE_REDIRECT_URI`.
2. Set `BACKUP_GDRIVE_CLIENT_ID` and `BACKUP_GDRIVE_CLIENT_SECRET` in `backend/.env` (do **not** commit).
3. `pm2 restart emdad-wms-backend-staging --update-env`
4. In admin UI → **Settings → Backups → Google Drive**, click **Connect Drive** and complete OAuth.
5. Re-run `node scripts/release-r4-dr-cert.mjs` and set `BACKUP_GDRIVE_SIMULATE_UPLOAD_FAILURE=true` temporarily to validate retry scheduling.

---

## 3. Google Drive Integration (Phase 2)

### Status API — PASS

```json
// GET /api/integrations/google-drive/status
{
  "connected": false,
  "gdriveEnabled": true,
  "gdriveConfigured": false,
  "rootFolderName": "EMDAD WMS Backups",
  "pendingSyncCount": 0,
  "failedSyncCount": 0
}
```

Evidence: [`01-drive-status.json`](docs/evidence/release-r4-dr/01-drive-status.json)

### Connect Drive — BLOCKED

```http
GET /api/integrations/google-drive/auth-url
→ 503 { "message": "Internal server error." }
```

OAuth client credentials are required before a Google authorization URL can be generated.

Evidence: [`01-drive-auth-url.json`](docs/evidence/release-r4-dr/01-drive-auth-url.json)

### Disconnect Drive — PASS

```http
DELETE /api/integrations/google-drive
→ 200 (idempotent when not connected)
```

Evidence: [`01-drive-disconnect.json`](docs/evidence/release-r4-dr/01-drive-disconnect.json)

### Reconnect — BLOCKED

Second `GET /auth-url` after disconnect returns **503** for the same reason as Connect.

### Test Connection — BLOCKED

Requires an active Drive connection (`connected: true`). Skipped with outcome **blocked** when disconnected.

Evidence: [`01-drive-test.json`](docs/evidence/release-r4-dr/01-drive-test.json)

### Drive audit events

No `backup.drive.connected` / `backup.drive.disconnected` events were emitted during this run (Drive was never connected).

Evidence: [`01-drive-audit.txt`](docs/evidence/release-r4-dr/01-drive-audit.txt)

### Drive evidence (files in Google Drive)

| Check | Result |
|-------|--------|
| Root folder `EMDAD WMS Backups` | **Not created** — OAuth not completed |
| Encrypted backup objects on Drive | **None** — no sync jobs executed |
| `gdrive_file_id` on backup_jobs | **All null** in DR snapshot job |

**Drive evidence status:** **BLOCKED — awaiting OAuth + connect.**

---

## 4. Storage Policies (Phase 3) — PASS

All three policies were accepted via `PUT /api/backups/storage-policy`:

| Policy | HTTP | Effective value |
|--------|------|-----------------|
| `local_only` | 200 | `local_only` |
| `local_and_drive` | 200 | `local_and_drive` |
| `drive_only` | 200 | `drive_only` |

Evidence: [`02-storage-policies.json`](docs/evidence/release-r4-dr/02-storage-policies.json)

**Note:** Policy PUT validates `BACKUP_GDRIVE_ENABLED` but does not require a live Drive connection. Actual upload to Drive for `local_and_drive` / `drive_only` backups remains untested until OAuth is configured.

Policy was reset to `local_only` before DR test to avoid Drive sync side effects.

---

## 5. Retry Engine (Phase 4)

### Exponential backoff math — PASS

Using staging env (`BASE_SEC=60`, `MAX_SEC=21600`):

| Attempt | Delay |
|---------|-------|
| 1 | 60 s (60,000 ms) |
| 2 | 120 s (120,000 ms) |
| 3 | 240 s (240,000 ms) |

Evidence: [`03-retry-math.json`](docs/evidence/release-r4-dr/03-retry-math.json)

### Forced upload failure — BLOCKED

The harness supports `BACKUP_GDRIVE_SIMULATE_UPLOAD_FAILURE=true` (implemented in `backup-drive-sync.service.ts`) to force upload errors and verify `gdrive_sync_status=failed` plus `gdrive_next_retry_at` scheduling.

**Not executed:** Drive not connected; no backup could be synced to Drive.

Evidence: [`03-retry-evidence.json`](docs/evidence/release-r4-dr/03-retry-evidence.json)

Retry audit query returned 0 rows (no `backup.drive.retry_scheduled` events).

Evidence: [`03-retry-audit.txt`](docs/evidence/release-r4-dr/03-retry-audit.txt)

---

## 6. Retention (Phase 5) — PASS

### Local retention

| Step | HTTP | Result |
|------|------|--------|
| `GET /backups/retention/preview` | 200 | 7 daily backups retained, 0 expired |
| `POST /backups/retention/cleanup` | 201 | `deletedCount: 0`, `bytesReclaimed: 0` |

Policies: keep last 7 daily / 4 weekly / 12 monthly; pre-snapshot protect 7 days.

Evidence: [`04-local-retention.json`](docs/evidence/release-r4-dr/04-local-retention.json)

### Drive retention

| Step | HTTP | Result |
|------|------|--------|
| `GET /backups/retention/drive/preview` | 200 | 0 eligible Drive objects (nothing synced) |
| `POST /backups/retention/drive/cleanup` | 201 | No deletions |

Policies: keep last 14 daily / 8 weekly / 24 monthly on Drive.

Evidence: [`04-drive-retention.json`](docs/evidence/release-r4-dr/04-drive-retention.json)

**Harness note:** Cleanup endpoints return HTTP **201 Created** on success. An initial harness version scored these as FAIL (201 ≠ 200). Corrected in `release-r4-dr-cert.mjs`; operational result is **PASS**.

---

## 7. Disaster Recovery (Phase 6) — PASS

### Procedure

```
1. Capture entity baseline (products, inventory, orders, tasks, users)
2. POST /backups { label: "RELEASE-R4-DR snapshot", storagePolicy: "local_only" }
3. Poll until backup job completed
4. POST /backups/:id/restore { confirmPhrase: "RESTORE", createPreSnapshot: true }
5. Poll restore job (DB fallback when schema dropped mid-restore)
6. Re-login and recount all entities
```

### Backup job

| Field | Value |
|-------|-------|
| Job ID | `29d13075-6725-40e6-a28f-fccb35c609be` |
| Label | `RELEASE-R4-DR snapshot` |
| Bytes written | 2,345,220 (~2.2 MB) |
| Create duration | ~68 s (includes cooldown wait from prior restore) |
| Artifact | `/var/lib/emdad-wms/backups/staging/29d13075-…/` |

Evidence: [`05-dr-backup.json`](docs/evidence/release-r4-dr/05-dr-backup.json)

### Restore job

| Field | Value |
|-------|-------|
| Restore job ID | `ce58ab21-2901-4dfb-a777-aba5d6e2dd97` |
| Source backup | `29d13075-6725-40e6-a28f-fccb35c609be` |
| Pre-snapshot | `53dd4fa4-35ae-4cf2-908e-b82728e0ce05` |
| Status | `completed` |
| **RTO (restore wall time)** | **9.3 s** |

Evidence: [`05-dr-restore.json`](docs/evidence/release-r4-dr/05-dr-restore.json)

### Entity integrity verification — PASS

| Entity | Before | After | Match |
|--------|-------:|------:|:-----:|
| Products | 93 | 93 | ✓ |
| Inventory (`current_stock`) | 77 | 77 | ✓ |
| Inbound orders | 66 | 66 | ✓ |
| Outbound orders | 33 | 33 | ✓ |
| Warehouse tasks | 194 | 194 | ✓ |
| Users | 7 | 7 | ✓ |

Evidence: [`05-dr-baseline.json`](docs/evidence/release-r4-dr/05-dr-baseline.json), [`05-dr-after-restore.json`](docs/evidence/release-r4-dr/05-dr-after-restore.json)

### Recovery metrics

| Metric | Definition | Measured |
|--------|------------|----------|
| **RTO** | Time from restore request to completed restore job | **9 s** |
| **RPO** | Data loss window (backup completion → disaster) | **~12 s** (synthetic — restore started immediately after backup) |

In a real incident, RPO equals time since last successful backup (local or Drive). With daily scheduled backups, worst-case RPO is ~24 h unless Drive sync is active.

---

## 8. Audit Events

### DR restore

```
 action          | actor_email              | resource_id                          | message
-----------------+--------------------------+--------------------------------------+------------------------------------------
 backup.restored | superadmin@emdad.example | ce58ab21-2901-4dfb-a777-aba5d6e2dd97 | restored backup 29d13075-6725-40e6-a28f-fccb35c609be
 backup.restored | superadmin@emdad.example | 4f22c0fc-2228-48a2-87e9-419c4bf4bd43 | restored backup 08fd4a90-6f3f-49b8-b0d3-d49818fb1630  (prior cert run)
```

Evidence: [`05-dr-restore-audit.txt`](docs/evidence/release-r4-dr/05-dr-restore-audit.txt)

### Drive / retry

No Drive connect, disconnect, upload, or retry audit events in this certification window (Drive never connected).

Full API trace: [`network-traces.jsonl`](docs/evidence/release-r4-dr/network-traces.jsonl)

---

## 9. Screenshots

Captured from staging admin UI (Playwright, 1440×900):

| File | Route | Description |
|------|-------|-------------|
| [`01-google-drive.png`](docs/evidence/release-r4-dr/screenshots/01-google-drive.png) | `/settings/backups/google-drive` | Drive settings — shows "not configured" / connect prompt |
| [`02-backup-history.png`](docs/evidence/release-r4-dr/screenshots/02-backup-history.png) | `/settings/backups` | Backup job history |
| [`03-local-retention.png`](docs/evidence/release-r4-dr/screenshots/03-local-retention.png) | `/settings/backups/retention` | Local retention policies UI |
| [`04-restore.png`](docs/evidence/release-r4-dr/screenshots/04-restore.png) | `/settings/backups/restore` | Restore workflow UI |
| [`05-health.png`](docs/evidence/release-r4-dr/screenshots/05-health.png) | `/settings/backups/health` | Backup health dashboard |

---

## 10. Readiness Scoring

### Method

26 checks weighted: **pass = 1.0**, **blocked = 0.35**, **fail = 0**, **skip = 0.5**

### Raw results (2026-06-06T02:06:22Z)

```
PASS     [config] gdrive_env
BLOCKED  [config] oauth_client
PASS     [config] auth
PASS     [drive] status_api
BLOCKED  [drive] connect_auth_url
BLOCKED  [drive] test_connection
PASS     [drive] disconnect
BLOCKED  [drive] reconnect_auth_url
PASS     [policies] local_only
PASS     [policies] local_and_drive
PASS     [policies] drive_only
PASS     [retry] backoff_math
BLOCKED  [retry] forced_failure
BLOCKED  [retry] retry_scheduled
PASS     [retention] local_preview
FAIL*    [retention] local_cleanup      ← HTTP 201 success; harness fixed
PASS     [retention] drive_preview
FAIL*    [retention] drive_cleanup      ← HTTP 201 success; harness fixed
PASS     [dr] create_backup
PASS     [dr] restore
PASS     [dr] verify_products
PASS     [dr] verify_inventory
PASS     [dr] verify_orders
PASS     [dr] verify_tasks
PASS     [dr] verify_users
PASS     [dr] entity_integrity
```

| Score type | Value |
|------------|------:|
| Raw (includes retention false negatives) | **77 / 100** |
| Corrected (retention = pass) | **85 / 100** |
| Full certification (OAuth + Drive + retry live) | **100 / 100** (projected after ops steps) |

Evidence: [`cert-summary.txt`](docs/evidence/release-r4-dr/cert-summary.txt), [`cert-results.json`](docs/evidence/release-r4-dr/cert-results.json)

---

## 11. Findings & Recommendations

### F-1 — Google Drive OAuth not provisioned (Critical for off-site DR)

| | |
|---|---|
| **Impact** | No off-site backup copies; `drive_only` policy cannot protect against VPS disk loss |
| **Evidence** | `gdriveConfigured: false`; auth-url 503; zero Drive audit events |
| **Action** | Provision OAuth client; connect Drive; re-run R4 cert phases 2, 4 (retry), and Drive retention with live files |

### F-2 — Storage policy API does not enforce Drive connection

| | |
|---|---|
| **Impact** | Operators can set `drive_only` without a connected Drive, causing silent sync failures |
| **Evidence** | `drive_only` PUT returned 200 while `connected: false` |
| **Action** | Consider rejecting `local_and_drive` / `drive_only` when `connected !== true` |

### F-3 — Local DR certified; RTO excellent on staging dataset

| | |
|---|---|
| **Impact** | Positive — 9 s restore for ~2.3 MB / 93 products validates local DR path |
| **Evidence** | Entity counts identical pre/post restore |
| **Action** | Re-measure RTO after production-scale data load |

### F-4 — Restore drops schema mid-job (known behavior)

| | |
|---|---|
| **Impact** | `GET /backups/:id/status` may error during restore; poll via DB or wait for completion |
| **Evidence** | Harness uses DB fallback in `pollJob()` — same as BACKUP-QA-1 |
| **Action** | Document in operator runbook (already noted in BACKUP-QA-1) |

---

## 12. Final DR Readiness Score

| Layer | Score | Status |
|-------|------:|--------|
| Local backup & restore | **100** | Certified |
| Entity integrity post-restore | **100** | Certified |
| Retention engine (API) | **100** | Certified |
| Google Drive integration | **35** | Blocked (env only) |
| Drive upload + retry | **35** | Blocked |
| **Overall RELEASE-R4 score** | **85 / 100** | **Partial — local DR ready** |

**Sign-off recommendation**

| Audience | Recommendation |
|----------|----------------|
| Staging UAT | **Approve** local backup/restore workflows |
| Production DR | **Hold** until Google Drive OAuth connected and upload + retry E2E pass |
| RELEASE-AUDIT-1 C-1 | **Partially addressed** — `BACKUP_GDRIVE_ENABLED=true` on staging; OAuth still open |

---

## Appendix — Re-run commands

```bash
# Full certification (API + DR restore)
node scripts/release-r4-dr-cert.mjs

# UI screenshots
node scripts/release-r4-dr-screenshots.mjs

# After OAuth configured — optional retry simulation
# Add BACKUP_GDRIVE_SIMULATE_UPLOAD_FAILURE=true to backend/.env, restart PM2, re-run cert
```

Harness log: [`docs/evidence/release-r4-dr/run.log`](docs/evidence/release-r4-dr/run.log)
