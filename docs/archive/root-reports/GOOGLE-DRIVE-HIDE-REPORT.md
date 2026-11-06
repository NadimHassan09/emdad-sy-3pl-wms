# Google Drive UI Hide — PHASE-1 Report

**Date:** 2026-06-11  
**Branch:** `staging`  
**Scope:** Frontend-only. Backend APIs, database schema, migrations, cron jobs, and tests are unchanged.

## Summary

Google Drive backup integration remains fully implemented on the server. For this deployment, all user-facing Drive surfaces are hidden behind a build-time flag:

```env
BACKUP_GDRIVE_UI_ENABLED=false   # default — no Drive UI
BACKUP_GDRIVE_UI_ENABLED=true    # restores prior UI behavior
```

The flag is injected via Vite `define` (`frontend/vite.config.ts`) and read by `isBackupGdriveUiEnabled()` in `frontend/src/lib/backup-gdrive-ui.ts`.

## Feature flag verification

| Check | `BACKUP_GDRIVE_UI_ENABLED=false` | `BACKUP_GDRIVE_UI_ENABLED=true` |
|-------|----------------------------------|----------------------------------|
| Built flag constant | `backup-gdrive-ui-*.js` resolves to `false` | Resolves to `true` |
| Settings nav "Google Drive" tab | Hidden | Visible |
| Route `/settings/backups/google-drive` | Redirects to `/settings/backups` | Full page |
| Storage policy selectors | `local_only` only (create, schedules, global policy) | All three policies |
| History "Drive sync" column | Hidden | Visible |
| Health Drive DR panel | Hidden | Visible |
| Health `gdrive_*` alerts | Filtered from UI | Shown |
| Retention Drive sections | Hidden | Visible |
| Storage policy Drive sync widget | Hidden | Visible |
| Create backup Drive warnings | Hidden | Visible |
| Backup detail Drive fields | Hidden | Visible |

**Build verification (default `false`):**

```bash
cd frontend && npm run build
# dist/assets/backup-gdrive-ui-*.js contains: return n("false")
```

**E2E note:** Drive specs (`e2e/backup-google-drive.spec.ts`, `backup-6d-*.spec.ts`) expect Drive UI. Run Vite with `BACKUP_GDRIVE_UI_ENABLED=true` in `frontend/.env` when executing those tests.

## Affected pages

| Page / route | Changes when flag is `false` |
|--------------|------------------------------|
| `/settings/backups` (History) | No "Drive sync" column; detail modal omits Drive metadata |
| `/settings/backups/schedules` | Schedule modal storage policy: Global default + Local only |
| `/settings/backups/retention` | Local retention only; Drive policies, preview, cleanup, audit panel hidden |
| `/settings/backups/health` | No Google Drive DR status section; `gdrive_*` alerts hidden |
| `/settings/backups/storage-policy` | Local policy + usage only; Drive sync status section hidden |
| `/settings/backups/google-drive` | Redirect to history (route kept for future rollout) |
| Settings sub-navigation | "Google Drive" tab removed |

## Hidden components

| Component | File |
|-----------|------|
| Settings nav tab | `settings-catalog.ts` → `getVisibleSettingsTabs()` |
| Google Drive settings page (entire) | `BackupGoogleDrivePage.tsx` |
| Drive sync column + badges | `BackupHistoryPage.tsx` |
| Drive fields in backup detail | `BackupDetailModal.tsx` |
| Storage policy selector (when only local) | `CreateBackupModal.tsx` |
| Drive connection warnings | `CreateBackupModal.tsx` |
| Google Drive DR status panel | `BackupHealthPage.tsx` |
| Drive-related health alerts | `BackupHealthPage.tsx` |
| Drive retention policies / preview / cleanup | `BackupRetentionPage.tsx` |
| Drive retention audit panel | `BackupDriveRetentionAuditPanel.tsx` (via retention page) |
| Google Drive sync status section | `BackupStoragePolicyPage.tsx` |
| Drive policy options in selectors | `localizedBackupStoragePolicyOptions()` in `settings-backup.ts` |

## Label sanitization (flag `false`)

Historical rows that used `drive_only` or `local_and_drive` still display in tables, but labels avoid "Google Drive":

- `drive_only` → "Off-site only"
- `local_and_drive` → "Local + off-site"

## Screenshots

Screenshots below describe the expected UI with `BACKUP_GDRIVE_UI_ENABLED=false` on staging. Capture locally with:

```bash
cd frontend
# ensure BACKUP_GDRIVE_UI_ENABLED=false in .env
npm run dev
# Log in as super_admin → Settings → Backups
```

### 1. Settings navigation (no Google Drive tab)

```
[ History ] [ Upload ] [ Restore ] [ Factory Reset ] [ Scheduled ] [ Retention ] [ Health ] [ Storage Policy ]
                                                                                              ↑ no "Google Drive"
```

### 2. Backup history table

Columns: Created At | Type | Status | Size | Created By | Storage | Actions  
(No "Drive sync" column.)

### 3. Storage policy page

Sections: Global storage policy | Storage usage  
(No "Google Drive sync status" section.)

### 4. Retention page

Sections: Local retention policies | Local cleanup preview | Local manual cleanup  
(No Drive retention blocks.)

### 5. Health page

Sections: Backup health dashboard | Metrics | Active alerts (non-Drive only) | Health audit  
(No "Google Drive DR status" panel.)

### 6. Direct URL `/settings/backups/google-drive`

Redirects to `/settings/backups` (history).

## Files changed (frontend only)

- `frontend/vite.config.ts` — expose `BACKUP_GDRIVE_UI_ENABLED`
- `frontend/.env.example` — document flag (default `false`)
- `frontend/src/lib/backup-gdrive-ui.ts` — new helper
- `frontend/src/lib/settings/settings-catalog.ts`
- `frontend/src/lib/ui-labels/settings-backup.ts`
- `frontend/src/components/settings/SettingsNav.tsx`
- `frontend/src/pages/settings/Backup*.tsx` (History, Health, Retention, Storage Policy, Google Drive)
- `frontend/src/components/backups/CreateBackupModal.tsx`
- `frontend/src/components/backups/BackupDetailModal.tsx`
- `frontend/playwright.config.ts` — E2E env note

## Intentionally unchanged

- Backend `BACKUP_GDRIVE_*` configuration and services
- Database tables and migrations
- REST APIs (`/api/integrations/google-drive/*`, drive retention endpoints)
- E2E test files
- `BackupGoogleDrivePage.tsx` source (page hidden, not deleted)

## Rollout to restore Drive UI

1. Set `BACKUP_GDRIVE_UI_ENABLED=true` in frontend build environment.
2. Rebuild and deploy admin SPA.
3. Provision backend OAuth (`BACKUP_GDRIVE_CLIENT_ID`, `BACKUP_GDRIVE_CLIENT_SECRET`, etc.) per `docs/ops/BACKUP-GOOGLE-DRIVE-RUNBOOK.md`.
