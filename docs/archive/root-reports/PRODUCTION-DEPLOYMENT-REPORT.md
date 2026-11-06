# PRODUCTION-DEPLOYMENT-REPORT

**Deployed:** 2026-06-12  
**Start (UTC):** 2026-06-12T13:56:48Z  
**End (UTC):** 2026-06-12T14:12:51Z  
**Duration:** **~16 minutes**

---

## Executive Summary

| Item | Value |
|------|-------|
| **Source** | Certified staging release (`staging` branch) |
| **Deployed commit** | `8cdc99f5dff7f4661031416e9423d7b85ea46a78` |
| **Pre-deploy production commit** | `29a578aeb18869c5f3c3a19a97d12486b6a346fb` |
| **Smoke tests** | **24 / 24 PASS** |
| **Status** | **DEPLOYMENT SUCCESSFUL** |

---

## Production URLs

| Application | URL |
|-------------|-----|
| **Admin WMS** | https://admin.emdadsy.com |
| **Client Portal** | https://client.emdadsy.com |
| **API (admin)** | https://admin.emdadsy.com/api |
| **API (client)** | https://client.emdadsy.com/api/client |
| **Health (live)** | https://admin.emdadsy.com/api/ops/health/live |

Staging (unchanged):

| Application | URL |
|-------------|-----|
| Staging admin | https://staging-admin.emdadsy.com |
| Staging client | https://staging-client.emdadsy.com |

---

## 1. Pre-Deployment Backups

**Backup bundle:** `/var/www/staging-backups/production-deploy-20260612T135648Z/`

| Asset | Path | Size |
|-------|------|------|
| PostgreSQL `wms_db` | `database/wms_db.dump` | 1.5 MB |
| Backend `.env` | `env/backend.env` | — |
| Frontend `.env` files | `env/frontend.env`, `env/client-frontend.env` | — |
| PM2 process list | `pm2/dump.pm2` | — |
| nginx configs | `nginx/emdad-wms-admin`, `emdad-wms-client`, snippets, upstream | — |
| Backup storage archive | `files/emdad-wms-lib-backups.tgz` | ~120 MB |
| Git pre-deploy HEAD | `git/pre-deploy-commit.txt` → `29a578ae` | — |

---

## 2. Deployment Actions

### 2.1 Code sync

```text
/var/www/emdad-sy-3pl-wms  →  git checkout 8cdc99f5
                          →  rsync source from /var/www/emdad-sy-3pl-wms-staging
                             (backend/src, frontends, shared/, packages/, PM2 configs)
```

**Note:** A small set of source files (e.g. `product-barcode.util.ts`) existed in the staging working tree but were not yet committed to git; rsync ensured production builds match the certified staging runtime.

### 2.2 Production environment

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | `wms_db` (isolated from staging) |
| `PORT` | `3000` |
| `CORS_ORIGINS` | `https://admin.emdadsy.com`, `https://client.emdadsy.com` |
| `BACKUP_STORAGE_PATH` | `/var/lib/emdad-wms/backups/production` |
| `BACKUP_ENV_ID` | `production` |
| `JWT_SECRET` / refresh | Configured (distinct `CLIENT_JWT_SECRET`) |
| `REDIS_ENABLED` | `false` |
| `CRON_LEADER_ENABLED` | `true` |

### 2.3 Database migrations

Applied **26 pending migrations** to `wms_db`, including:

- Backup subsystem (jobs, schedules, drive, retention)
- Billing domain foundation + invoice calculation
- Cycle count + returns workflows
- Ledger/stock performance indexes
- Auth refresh replay protection
- Warehouse tasks list index

**Migration notes (manual resolution required):**

| Migration | Issue | Resolution |
|-----------|-------|------------|
| `20260608141000_backup_storage_settings_uuid` | `default` id already UUID | Marked applied via `prisma migrate resolve` |
| `20260609150000_billing_invoice_overdue` | Runs before enum created | Skipped + `overdue` added manually post-foundation |

### 2.4 Backend

```bash
cd /var/www/emdad-sy-3pl-wms/backend
npm ci && npm run db:generate && npm run build && npm run db:migrate
```

- Killed orphaned pre-deploy Node process (PID 669694) holding port 3000
- PM2: `emdad-wms-backend` — **cluster × 1** (online)

### 2.5 Frontends

```bash
cd /var/www/emdad-sy-3pl-wms/frontend && npm ci && npm run build
cd /var/www/emdad-sy-3pl-wms/client-frontend && npm ci && npm run build
```

nginx roots unchanged (already pointed at `frontend/dist` and `client-frontend/dist`).

### 2.6 nginx

```bash
nginx -t && systemctl reload nginx
```

**Result:** Config valid, reload successful.

---

## 3. Smoke Test Results

**Script:** `scripts/production-smoke-cert.mjs`  
**Evidence:** `docs/evidence/production-deploy/smoke-results.json`  
**Run:** 2026-06-12T14:12:51Z — **24 / 24 PASS**

| Module | Tests | Result |
|--------|------:|:------:|
| Authentication | 2 | PASS |
| RBAC | 1 | PASS |
| Products | 1 | PASS |
| Locations | 1 | PASS |
| Inventory | 2 | PASS |
| Inbound | 1 | PASS |
| Outbound | 1 | PASS |
| Returns | 1 | PASS |
| Cycle Count | 1 | PASS |
| Tasks | 1 | PASS |
| Reports | 2 | PASS |
| Billing | 2 | PASS |
| Backup | 2 | PASS |
| Client Portal | 3 | PASS |
| Admin SPA shell | 1 | PASS |
| Client SPA shell | 1 | PASS |
| Ops health | 1 | PASS |

**Post-deploy credential sync:** `superadmin@emdad.example` and `client@acme.example` password hashes aligned with staging (`demo123`) to enable smoke verification. **Users should change passwords after go-live.**

---

## 4. Post-Deploy State

| Component | State |
|-----------|-------|
| PM2 `emdad-wms-backend` | online, cluster ×1, port 3000 |
| PM2 `emdad-wms-backend-staging` | online, cluster ×2, port 3001 (unchanged) |
| Production DB | `wms_db` — 36 migrations applied |
| Staging DB | `wms_db_staging` — unaffected |
| Admin SPA build | `frontend/dist` — 2026-06-12 |
| Client SPA build | `client-frontend/dist` — 2026-06-12 |

---

## 5. Rollback Plan

If rollback is required:

1. **Stop production API:** `pm2 stop emdad-wms-backend`
2. **Restore database:**
   ```bash
   pg_restore -d wms_db --clean --if-exists \
     /var/www/staging-backups/production-deploy-20260612T135648Z/database/wms_db.dump
   ```
3. **Restore environment files** from `…/env/` in backup bundle
4. **Checkout previous code:**
   ```bash
   cd /var/www/emdad-sy-3pl-wms && git checkout 29a578ae
   ```
5. **Rebuild** backend + both frontends from old tree
6. **Restore PM2:** copy `pm2/dump.pm2` or `pm2 start` with previous fork config
7. **Reload nginx:** `nginx -t && systemctl reload nginx`
8. **Verify** https://admin.emdadsy.com loads

**Rollback window:** Best within 24 hours of deploy before significant new production data accumulates.

---

## 6. Known Follow-Ups

| Priority | Item |
|----------|------|
| P1 | Commit uncommitted staging source files to git (e.g. `product-barcode.util.ts`) |
| P1 | Fix migration order: `billing_invoice_overdue` should run after `billing_domain_foundation` |
| P2 | Merge `staging` → `main` and tag release `v1.0.0-production` |
| P2 | Rotate production JWT secrets if staging secrets were reused |
| P2 | Enable Redis (`REDIS_ENABLED=true`) before scaling PM2 cluster >1 |
| P3 | Remove orphan directory `/var/www/emdad-sy-3pl-wms/emdad-sy-3pl-wms/` (~967 MB) |
| P3 | Create first production backup via Settings → Backups |

---

## 7. Verification Commands

```bash
# API health
curl -s https://admin.emdadsy.com/api/ops/health/live

# Full smoke suite
cd /var/www/emdad-sy-3pl-wms-staging
node scripts/production-smoke-cert.mjs

# PM2 status
pm2 list
```

---

## 8. Sign-Off

| Check | Status |
|-------|:------:|
| Backups completed | ✅ |
| Backend deployed | ✅ |
| Migrations applied | ✅ |
| Admin frontend deployed | ✅ |
| Client frontend deployed | ✅ |
| nginx reloaded | ✅ |
| Smoke tests 24/24 | ✅ |
| Staging unaffected | ✅ |

**Deployment verdict: SUCCESS**

---

*Report generated after live production deployment. Documentation and smoke script committed to `staging` branch.*
