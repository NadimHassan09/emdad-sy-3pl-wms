# STAGING-DECOMMISSION-AUDIT

**Audit date:** 2026-06-12  
**Auditor:** PHASE-CLOSE-1 automated infrastructure audit  
**Production URLs:** https://admin.emdadsy.com, https://client.emdadsy.com  
**Staging URLs (to decommission):** https://staging-admin.emdadsy.com, https://staging-client.emdadsy.com

---

## Executive Summary

| Check | Result |
|-------|--------|
| Production independent from staging | **YES — SAFE TO DECOMMISSION** |
| Shared nginx production vhosts reference staging | **NO** |
| Production PM2 depends on staging assets | **NO** |
| Shared backup paths | **NO** (separate directories) |
| Shared database | **NO** (`wms_db` vs `wms_db_staging`) |
| Symlinks from production to staging | **NONE** |

Production is fully isolated. Staging resources can be removed without affecting live operation.

---

## 1. Production Dependency Verification

### 1.1 Nginx — Production vhosts

| Vhost | Root / upstream | Staging reference |
|-------|-----------------|-------------------|
| `emdad-wms-admin` | `/var/www/emdad-sy-3pl-wms/frontend/dist` | **None** |
| `emdad-wms-client` | `/var/www/emdad-sy-3pl-wms/client-frontend/dist` | **None** |
| `snippets/emdad-wms-backend-locations.conf` | `upstream emdad_wms_backend` → `127.0.0.1:3000` | **None** |

Production vhosts use only `/var/www/emdad-sy-3pl-wms/` and port **3000**.

### 1.2 PM2 — Production process

| Process | CWD | Script | Port |
|---------|-----|--------|------|
| `emdad-wms-backend` | `/var/www/emdad-sy-3pl-wms/backend` | `dist/src/main.js` | 3000 |

No staging paths in production PM2 configuration.

### 1.3 Backend runtime

| Setting | Production | Staging |
|---------|------------|---------|
| `DATABASE_URL` | `wms_db` | `wms_db_staging` |
| `PORT` | 3000 | 3001 |
| `BACKUP_STORAGE_PATH` | `/var/lib/emdad-wms/backups/production` | `/var/lib/emdad-wms/backups/staging` |
| `BACKUP_ENV_ID` | `production` | `staging` |
| `CORS_ORIGINS` | prod domains only | staging domains |

### 1.4 Frontend build artifacts

| App | Production path | Staging path |
|-----|-----------------|--------------|
| Admin SPA | `/var/www/emdad-sy-3pl-wms/frontend/dist` (2.5 MB) | `/var/www/emdad-sy-3pl-wms-staging/frontend/dist` (2.5 MB) |
| Client SPA | `/var/www/emdad-sy-3pl-wms/client-frontend/dist` (824 KB) | separate copy |

Production nginx serves only production `dist/` directories.

### 1.5 Symlinks

- **Production tree:** No symlinks pointing to staging (verified `find -type l`).
- **Staging tree:** Only internal `node_modules/.bin` symlinks (normal npm layout).

### 1.6 Upload / shared paths

No shared upload directories between production and staging detected.

---

## 2. Staging Dependency Map (Resources to Remove)

### 2.1 Repository

| Path | Size | Purpose |
|------|------|---------|
| `/var/www/emdad-sy-3pl-wms-staging/` | **1.1 GB** | Staging git repo + source + node_modules |

### 2.2 PM2 processes

| Process | Instances | CWD | Port |
|---------|-----------|-----|------|
| `emdad-wms-backend-staging` | 2 | `/var/www/emdad-sy-3pl-wms-staging/backend` | 3001 |

### 2.3 Nginx — Staging vhosts

| File | Domain |
|------|--------|
| `sites-enabled/emdad-wms-staging-admin` | staging-admin.emdadsy.com |
| `sites-enabled/emdad-wms-staging-client` | staging-client.emdadsy.com |
| `sites-available/emdad-wms-staging-admin` | — |
| `sites-available/emdad-wms-staging-client` | — |
| `snippets/emdad-wms-staging-backend-locations.conf` | proxy → port 3001 |
| `conf.d/01-emdad-wms-staging-upstream.conf` | upstream `emdad_wms_backend_staging` |
| `ssl/emdad-wms-staging/` | staging TLS cert/key |

### 2.4 Staging logs

| Path | Approx size |
|------|-------------|
| `/var/log/nginx/emdad-staging-admin.*` | ~600 KB |
| `/var/log/nginx/emdad-staging-client.*` | ~100 KB |
| PM2 staging logs | minimal |

### 2.5 Staging backup storage

| Path | Size | Action |
|------|------|--------|
| `/var/lib/emdad-wms/backups/staging` | **168 MB** | **DELETE** |
| `/var/www/staging-backups/nginx-20260530` | 36 KB | DELETE (staging nginx snapshot) |
| `/var/www/staging-backups/production-deploy-20260612T135648Z` | **122 MB** | **KEEP** (production pre-deploy backup) |

### 2.6 Staging database (retained — not in scope)

| Database | Size | Note |
|----------|------|------|
| `wms_db_staging` | 52 MB | Retained; no production dependency. Optional manual drop later. |

---

## 3. Orphaned / Duplicate Resources

| Resource | Path | Size | Recommendation |
|----------|------|------|----------------|
| Duplicate repository | `/var/www/emdad-sy-3pl-wms-staging` | 1.1 GB | Delete |
| Production repo (canonical) | `/var/www/emdad-sy-3pl-wms` | 2.0 GB | **Keep** |
| Nested orphan copy | `/var/www/emdad-sy-3pl-wms/emdad-sy-3pl-wms` | **967 MB** | Flag for separate cleanup (not staging) |
| Duplicate `node_modules` | staging backend 514M + frontend 166M + client 132M | ~812 MB | Deleted with staging tree |
| Duplicate `dist` | staging backend 8.1M + frontends 3.3M | ~11 MB | Deleted with staging tree |
| Duplicate git remotes | Both repos → `github.com/NadimHassan09/emdad-sy-3pl-wms` | — | Keep GitHub; delete local staging clone |

---

## 4. Disk Usage Analysis

### Before decommission

| Mount | Total | Used | Avail | Use% |
|-------|------:|-----:|------:|-----:|
| `/` (`/dev/sda1`) | 96 GB | 13 GB | 84 GB | 13% |

| Component | Size |
|-----------|-----:|
| `/var/www/emdad-sy-3pl-wms` (production) | 2.0 GB |
| `/var/www/emdad-sy-3pl-wms-staging` | 1.1 GB |
| `/var/www/emdad-sy-3pl-wms/emdad-sy-3pl-wms` (orphan) | 967 MB |
| `/var/lib/emdad-wms/backups/staging` | 168 MB |
| `/var/lib/emdad-wms/backups/production` | 2.9 MB |
| `/var/www/staging-backups/` (total) | 122 MB |
| `wms_db_staging` (PostgreSQL) | 52 MB |

**Estimated reclaimable (staging decommission):** ~1.27 GB  
(staging repo 1.1 GB + staging backups 168 MB + nginx/logs/ssl ~5 MB)

---

## 5. Decommission Execution Plan

### Phase A — Stop staging services (no production impact)

1. `pm2 delete emdad-wms-backend-staging`
2. `pm2 save`

### Phase B — Remove staging nginx

1. Remove symlinks from `sites-enabled/`
2. Delete staging vhost files, snippet, upstream conf
3. `nginx -t && systemctl reload nginx`

### Phase C — Remove staging files

1. Delete `/var/lib/emdad-wms/backups/staging`
2. Delete `/var/www/staging-backups/nginx-20260530`
3. Delete staging nginx logs
4. Delete `/etc/nginx/ssl/emdad-wms-staging/` (optional)
5. Delete `/var/www/emdad-sy-3pl-wms-staging` (after git push)

### Phase D — Verify production

1. `curl https://admin.emdadsy.com/api/ops/health/live`
2. `curl https://client.emdadsy.com/api/client/auth/me` (expect 401)
3. `pm2 status emdad-wms-backend`
4. `nginx -t`

### Out of scope (preserve production)

- `/var/www/emdad-sy-3pl-wms/` — production codebase
- `/var/lib/emdad-wms/backups/production/` — production backups
- `/var/www/staging-backups/production-deploy-*` — production deploy snapshot
- `wms_db` — production database
- PM2 `emdad-wms-backend` — production backend

---

## 6. Audit Verdict

**APPROVED FOR STAGING DECOMMISSION**

Production at `admin.emdadsy.com` and `client.emdadsy.com` has zero runtime dependency on staging infrastructure. Safe to proceed with removal per execution plan above.

---

*Audit performed 2026-06-12. See `STAGING-DECOMMISSION-REPORT.md` for execution results.*
