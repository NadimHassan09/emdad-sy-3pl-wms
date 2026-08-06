# Staging Recreation from Production — Sync Report

**Date (UTC):** 2026-08-06  
**Operator:** automated sync agent  
**Goal:** Make staging an exact functional copy of production, with environment-specific config only.

---

## Summary

| Item | Result |
|------|--------|
| Production branch created/pushed | `origin/production` @ `0b82d370` |
| Staging deployment replaced | `/var/www/emdad-sy-3pl-wms-staging` rsynced from production |
| Staging DB recreated | `wms_db_staging` restored from `wms_db` (129 tables, identical row counts) |
| Production data modified | **No** (read-only `pg_dump` only) |
| Production process disturbed | **No** (PM2 PID `1143` unchanged throughout) |
| Staging secrets in branch | Staging JWT/DB/CORS values retained (not production secrets) |

---

## Step 1 — Production branch

### Pre-state
- Path: `/var/www/emdad-sy-3pl-wms`
- Was on local branch `staging` @ `0dd48817` with a large dirty working tree (~2360 porcelain entries: source, `dist`, tracked `node_modules`, env config).
- Remote had **no** `production` branch.

### Actions
1. `git checkout -b production`
2. Staged running application tree (backend, frontends, shared, prisma, built artifacts, package locks).
3. **Excluded from commit:** nested clone `emdad-sy-3pl-wms/`, `.cursor/`, `.agents/`, `.aidesigner/`, `.deploy-backup/`, `backups/`, `backend/storage/`, `Untitled`, `SYSTEM-ARCHITECTURE copy.md`.
4. Commit: `0b82d370` — *Sync production server working tree to production branch.*
5. Pushed: `git push -u origin production`

### Verification
- Tracked working tree clean vs `HEAD` (0 dirty tracked files).
- Live app continued serving `admin.emdadsy.com` / `client.emdadsy.com`.

---

## Step 2 — Staging deployment replacement

### Backup
- `/var/www/staging-backups/staging-recreate-20260806T171826Z/`
  - `env/backend.env`, `env/frontend.env`, `env/client-frontend.env`
  - `config/ecosystem.staging.config.js`, `config/ecosystem.config.js`
  - nginx staging config copies
  - later: `wms_db_for_staging.dump`

### Actions
1. `pm2 stop emdad-wms-backend-staging` (production left running).
2. `rsync -a --delete` from production → staging, **keeping** staging `.git`, excluding tooling/runtime dirs listed above.
3. Restored staging-specific files from backup:
   - `backend/.env` (PORT 3001, `wms_db_staging`, staging CORS, staging JWT secrets, `BACKUP_ENV_ID=staging`, `DOCUMENT_STORAGE_DIR`, etc.)
   - `frontend/.env`, `client-frontend/.env`
   - `ecosystem.staging.config.js` (loads staging `.env`, pins `PORT=3001`)
   - `ecosystem.config.js` (staging path reference)
4. Ensured `backend/storage/documents` exists.

### Unchanged (system-level)
- nginx sites: `emdad-wms-staging-admin`, `emdad-wms-staging-client`
- snippet: `emdad-wms-staging-backend-locations.conf`
- SSL under `/etc/nginx/ssl/emdad-wms-staging/`
- Production nginx / PM2 production app / `wms_db`

---

## Step 3 — Database

| Source | Target |
|--------|--------|
| `wms_db` (production) | `wms_db_staging` |

1. `pg_dump -Fc` of `wms_db` (read-only).
2. `dropdb wms_db_staging` + `createdb -O wms_user`.
3. `pg_restore --no-owner --role=wms_user`.
4. Grants on schema/tables/sequences to `wms_user`.
5. Verified **129** public tables, **0** row-count mismatches.

Staging `DATABASE_URL` remains `.../wms_db_staging?...`.  
Runtime PM2 env confirmed `wms_db_staging` and `PORT=3001`.

### Migrations
- `npx prisma migrate status` against staging DB: **64 migrations, schema up to date.**

---

## Step 4 — Git (staging branch)

- Branch `staging` retained (not deleted).
- Working tree updated to match recreated deployment; commit + push to `origin/staging` (this report included).

---

## Step 5 — Verification checklist

| Check | Result |
|-------|--------|
| Production admin HTTPS | 200 |
| Production API `/api/companies` | 401 (auth required) |
| Production PM2 PID | unchanged (`1143`) |
| Staging backend direct `:3001` | 401 |
| Staging admin/client via nginx Host | 200 |
| Staging API via nginx | 401 |
| Staging uses `wms_db_staging` | yes |
| Prisma migrations in sync | yes |
| Client frontend `npm run build` | success |
| Admin frontend `tsc -b && vite build` | **fails** (pre-existing TS errors also present on production tree) |
| Admin frontend `vite build` only | success |
| Deployed `frontend/dist` / `client-frontend/dist` | restored identical to production dist after build checks |

### Environment-specific differences (expected)

| Setting | Production | Staging |
|---------|------------|---------|
| Path | `/var/www/emdad-sy-3pl-wms` | `/var/www/emdad-sy-3pl-wms-staging` |
| PORT | 3000 | 3001 |
| Database | `wms_db` | `wms_db_staging` |
| CORS / domains | `admin` / `client`.emdadsy.com | `staging-admin` / `staging-client`.emdadsy.com |
| JWT secrets | production values | staging values (distinct) |
| REDIS_KEY_PREFIX | `wms:` | `wms-staging:` |
| BACKUP_ENV_ID / path | production | staging |
| DOCUMENT_STORAGE_DIR | (unset on prod) | staging documents path |
| PM2 name | `emdad-wms-backend` | `emdad-wms-backend-staging` |

---

## Files / config touched

### Production repo
- New branch `production`; large sync commit of live tree (see git show `0b82d370`).
- No nginx/PM2/DB mutations.

### Staging deployment tree
- Entire application tree replaced via rsync from production (except `.git` and excluded runtime/tooling).
- Restored: `backend/.env`, `frontend/.env`, `client-frontend/.env`, `ecosystem.staging.config.js`, `ecosystem.config.js`.
- Added: this report `STAGING-PRODUCTION-SYNC-REPORT.md`.

### Database
- Dropped/recreated **only** `wms_db_staging`.
- Dump artifact: `staging-backups/staging-recreate-20260806T171826Z/wms_db_for_staging.dump`.

### Not changed
- Production database `wms_db`
- Production secrets on disk
- Git branch names deleted (none)
- Staging nginx site definitions
