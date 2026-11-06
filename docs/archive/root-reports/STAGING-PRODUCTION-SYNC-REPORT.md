# Staging Recreation from Production — Sync Report

**Date (UTC):** 2026-08-27  
**Operator:** automated sync agent  
**Goal:** Make staging an exact functional copy of production, with environment-specific config only.

---

## Summary

| Item | Result |
|------|--------|
| Production branch pushed | `origin/production` @ `ba64e70b` |
| Staging deployment replaced | `/var/www/emdad-sy-3pl-wms-staging` rsynced from production |
| Staging DB recreated | `wms_db_staging` restored from `wms_db` (138 tables) |
| Production data modified | **No** (read-only `pg_dump` only) |
| Production process disturbed | **No** (PM2 PID `538264` unchanged throughout) |
| Staging secrets in tree | Staging JWT/DB/CORS/PORT values retained (not production secrets) |

---

## Step 1 — Production branch

### Pre-state
- Path: `/var/www/emdad-sy-3pl-wms`
- Branch reset to track live `main` tip then synced dirty working tree.
- Commit: `ba64e70b` — *chore: sync live production working tree to production branch.*
- Pushed: `git push -u origin production` (`7583b377..ba64e70b`)

### Excluded from commit
- `backend/storage/` (runtime PDFs/documents)
- nested clone `emdad-sy-3pl-wms/`
- `.cursor/`, `.agents/`, `.aidesigner/`, `.deploy-backup/`, `backups/`

---

## Step 2 — Staging deployment replacement

### Backup
- `/var/www/staging-backups/staging-recreate-20260827T023904Z/`
  - `env/backend.env`, `env/frontend.env`, `env/client-frontend.env`
  - `config/ecosystem.staging.config.js`, `config/ecosystem.config.js`
  - nginx staging config copies
  - `wms_db_for_staging.dump`

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
5. Verified **138** public tables on both.

Staging `DATABASE_URL` remains `.../wms_db_staging?...`.  
Runtime PM2 env confirmed `wms_db_staging` and `PORT=3001`.

### Migrations
- `npx prisma migrate status` against staging DB: **87 migrations, schema up to date.**

---

## Step 4 — Git (staging branch)

- Branch `staging` retained.
- Working tree updated to match recreated deployment; commit + push to `origin/staging` (this report included).

---

## Step 5 — Verification checklist

| Check | Result |
|-------|--------|
| Production admin HTTPS | 200 |
| Production client HTTPS | 200 |
| Production API `/api/companies` | 401 |
| Production PM2 PID | unchanged (`538264`) |
| Staging backend direct `:3001` | 401 |
| Staging admin/client via nginx Host | 200 |
| Staging API via nginx | 401 |
| Staging uses `wms_db_staging` | yes |
| Prisma migrations in sync | yes |
| Frontend dist hashes match production snapshot | yes |

### Environment-specific differences (expected / enforced)

| Setting | Production | Staging |
|---------|------------|---------|
| Path | `/var/www/emdad-sy-3pl-wms` | `/var/www/emdad-sy-3pl-wms-staging` |
| PORT | 3000 | 3001 |
| Database | `wms_db` | `wms_db_staging` |
| CORS / domains | `admin` / `client`.emdadsy.com | `staging-admin` / `staging-client`.emdadsy.com |
| JWT secrets | production values | staging values (distinct) |
| REDIS_KEY_PREFIX | `wms:` | `wms-staging:` |
| BACKUP_ENV_ID / path | production | staging |
| DOCUMENT_STORAGE_DIR | (prod default) | staging documents path |
| PM2 name | `emdad-wms-backend` | `emdad-wms-backend-staging` |
| nginx root | `/var/www/emdad-sy-3pl-wms/.../dist` | `/var/www/emdad-sy-3pl-wms-staging/.../dist` |

---

## Not changed
- Production database `wms_db`
- Production secrets on disk
- Production PM2 process / nginx
- Staging nginx site definitions
