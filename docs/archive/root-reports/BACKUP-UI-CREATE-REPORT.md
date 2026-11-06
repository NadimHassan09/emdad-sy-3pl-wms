# BACKUP-UI-CREATE — Manual Backup Creation UI

**Generated:** 2026-06-09  
**Environment:** staging (`http://127.0.0.1:3001` API · `https://staging-admin.emdadsy.com` UI)  
**Branch:** `staging`  
**Prior art:** `BACKUP-GAP-ANALYSIS.md` (BK-1), `BACKUP-QA-1-REPORT.md`, `BACKUP-6C-REPORT.md`

---

## Executive Summary

Manual backup creation is now exposed in **Settings → Backups → History** for `super_admin` users. The UI calls the existing `POST /api/backups` endpoint, supports per-backup storage policy selection (`local_only`, `drive_only`, `local_and_drive`), shows live progress/success/failure states, auto-refreshes history, and surfaces recent backup audit events.

| Deliverable | Status |
|-------------|--------|
| Create Backup action on History page | ✓ |
| `BackupsApi.create()` client | ✓ |
| Storage policy selector in modal | ✓ |
| Progress / success / failure states | ✓ |
| Auto-refresh history + audit panel | ✓ |
| `super_admin` only (RBAC) | ✓ |
| Playwright E2E (8 tests) | ✓ 8/8 |
| API verification (create + download URL) | ✓ |
| Screenshots | ✓ 4 captures |

---

## 1. Problem (BK-1)

`POST /api/backups` was production-ready (PERF-QA-1, BACKUP-6C scripts) but the admin dashboard had **no UI** to trigger manual backups — only history, upload, restore, schedules, and Drive settings.

---

## 2. Implementation

### 2.1 API client

`frontend/src/api/backups.ts`

```typescript
create(body: CreateBackupInput): Promise<CreateBackupResult>
// POST /backups { label?, storagePolicy? }
```

### 2.2 Create modal

`frontend/src/components/backups/CreateBackupModal.tsx`

- Optional label (max 200 chars)
- Storage policy dropdown (`localizedBackupStoragePolicyOptions`)
- Default policy from `GET /backups/storage-policy`
- Drive policies disabled when Google Drive not connected
- Submit → `BackupsApi.create()`

### 2.3 History page integration

`frontend/src/pages/settings/BackupHistoryPage.tsx`

| Feature | Implementation |
|---------|----------------|
| Create button | `DataTable` `actions` slot — `super_admin` only via `useBackupAdminAccess().canMutate` |
| Progress banner | Polls `GET /backups/:id/status` every 2s while job pending/running |
| Success banner | Shown on `completed`; auto-clears after 4s |
| Failure banner | Shows `errorMessage`; dismissible |
| History refresh | `refetchInterval: 3s` on list query while job active; invalidates `QK.backups.all` on terminal state |
| Audit visibility | `BackupAuditPanel` for `super_admin` (includes `backup.created` events) |
| RBAC | `wh_manager` sees history read-only; no create button or audit panel |

### 2.4 Backend (unchanged)

- `POST /api/backups` — `SuperAdminGuard` + service role check
- Throttle: 3 req / 60s; manual cooldown: 60s on staging
- Audit: `backup.created` logged on completion (`backup-runner.service.ts`)

---

## 3. Verification

### 3.1 API certification

**Script:** `scripts/backup-ui-create-verify.mjs`  
**Evidence:** `docs/evidence/backup-ui-create/verify-results.json`

| Step | Result |
|------|--------|
| Login | PASS |
| `POST /backups` (`local_only`) | PASS — job completed ~0.6s, 2.26 MB |
| `POST /backups/:id/download-url` | PASS |
| Drive status check | PASS — Drive not connected on staging (sync N/A) |

### 3.2 Playwright E2E

**Spec:** `frontend/e2e/backup-create-ui.spec.ts`  
**Evidence:** `docs/evidence/backup-ui-create/e2e-results.txt`

```
8 passed (21.3s)
```

| Test | Coverage |
|------|----------|
| Warmup | Dev bundle preload |
| History + audit panel | Create button visible |
| Modal fields | Label, storage policy options |
| Success flow | Progress → success banners |
| Failure flow | Failure banner + error text |
| RBAC | `wh_manager` — no create, no audit |
| Drive policy | Disabled submit when Drive disconnected |
| Screenshots | Report captures |

### 3.3 Screenshots

`docs/screenshots/backup-ui-create/`

| File | Scene |
|------|-------|
| `01-history-create-btn.png` | History page with Create backup CTA |
| `02-create-modal.png` | Modal with label + storage policy |
| `03-create-progress.png` | In-progress banner with % |
| `04-create-success.png` | Success banner + refreshed history |

### 3.4 Drive sync

Google Drive is **not connected** on staging (`BACKUP_GDRIVE_CLIENT_ID/SECRET` unset per BACKUP-6C). Drive policy UI validation is covered by E2E mocks; live Drive sync verification deferred until OAuth is configured.

---

## 4. Files Changed

| File | Change |
|------|--------|
| `frontend/src/api/backups.ts` | `create()`, types |
| `frontend/src/components/backups/CreateBackupModal.tsx` | New modal |
| `frontend/src/pages/settings/BackupHistoryPage.tsx` | Create flow + states + audit |
| `frontend/e2e/backup-create-ui.spec.ts` | E2E suite |
| `frontend/scripts/capture-backup-ui-create-screenshots.mjs` | Screenshot helper |
| `scripts/backup-ui-create-verify.mjs` | API verification |

---

## 5. Usage

1. Sign in as `super_admin`
2. Navigate to **Settings → Backups → History**
3. Click **Create backup**
4. Optionally set label and storage policy
5. Confirm — progress appears inline; history auto-refreshes on completion
6. Download completed backup from history table (existing action)

---

## 6. Rollout

```bash
cd frontend && npm run build
# Deploy admin static assets to staging-admin.emdadsy.com
node scripts/backup-ui-create-verify.mjs   # API smoke
cd frontend && BASE_URL=http://127.0.0.1:5173 npx playwright test e2e/backup-create-ui.spec.ts
```

Pushed to GitHub `staging` branch with this report and evidence bundle.
