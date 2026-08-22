# PRODUCTION-DEPLOYMENT-PLAN

**Generated:** 2026-06-12  
**Source release:** `staging` @ `8cdc99f5` (certified)  
**Source URLs:** `staging-admin.emdadsy.com`, `staging-client.emdadsy.com`  
**Target URLs:** `admin.emdadsy.com`, `client.emdadsy.com`

---

## 1. Objective

Deploy the certified staging codebase to the production installation without affecting the staging environment. Production and staging remain isolated (separate directories, databases, ports, nginx vhosts).

---

## 2. Pre-deployment state

| Item | Production (before) | Staging (source) |
|------|---------------------|------------------|
| Directory | `/var/www/emdad-sy-3pl-wms` | `/var/www/emdad-sy-3pl-wms-staging` |
| Git commit | `29a578ae` (main) | `8cdc99f5` (staging) |
| Database | `wms_db` | `wms_db_staging` |
| API port | `3000` | `3001` |
| PM2 app | `emdad-wms-backend` (fork ×1) | `emdad-wms-backend-staging` (cluster ×2) |

---

## 3. Deployment phases

### Phase 0 — Record start time

Note UTC timestamp for deployment duration in the final report.

### Phase 1 — Pre-deployment backups

Create backup bundle at `/var/www/staging-backups/production-deploy-<timestamp>/`:

| # | Asset | Command / action |
|---|-------|------------------|
| 1 | PostgreSQL `wms_db` | `pg_dump -Fc wms_db > database/wms_db.dump` |
| 2 | Backend `.env` | Copy `backend/.env` |
| 3 | Frontend `.env` files | Copy `frontend/.env`, `client-frontend/.env` |
| 4 | PM2 process list | `pm2 save` + copy `dump.pm2` |
| 5 | nginx configs | Copy `emdad-wms-admin`, `emdad-wms-client`, snippets, upstream |
| 6 | Uploaded / backup files | Archive `/var/lib/emdad-wms/backups/` (if production data exists) |
| 7 | Git HEAD | Record `git rev-parse HEAD` |

### Phase 2 — Sync codebase

```bash
cd /var/www/emdad-sy-3pl-wms
git fetch origin
git checkout 8cdc99f5   # certified staging commit
```

### Phase 3 — Production environment

Write `/var/www/emdad-sy-3pl-wms/backend/.env` with production values:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | `postgresql://…/wms_db` |
| `PORT` | `3000` |
| `NODE_ENV` | `production` |
| `CORS_ORIGINS` | `https://admin.emdadsy.com,https://client.emdadsy.com` |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | From secure backup or staging (rotate post-cutover if desired) |
| `BACKUP_ENABLED` | `true` |
| `BACKUP_STORAGE_PATH` | `/var/lib/emdad-wms/backups/production` |
| `BACKUP_ENV_ID` | `production` |
| `CRON_LEADER_ENABLED` | `true` |
| `REDIS_ENABLED` | `false` (matches current staging; enable later for WS cluster) |

Preserve production database credentials from pre-deploy backup.

### Phase 4 — Backend deploy

```bash
cd /var/www/emdad-sy-3pl-wms/backend
npm ci
npm run db:generate
npm run build
npm run db:migrate    # against wms_db
```

### Phase 5 — PM2 restart

```bash
cd /var/www/emdad-sy-3pl-wms
pm2 startOrReload ecosystem.config.js --update-env
pm2 save
```

Verify: `curl http://127.0.0.1:3000/api/ops/health/live`

### Phase 6 — Admin frontend deploy

```bash
cd /var/www/emdad-sy-3pl-wms/frontend
npm ci
npm run build
# nginx root already points to frontend/dist — no copy needed
```

### Phase 7 — Client frontend deploy

```bash
cd /var/www/emdad-sy-3pl-wms/client-frontend
npm ci
npm run build
# nginx root already points to client-frontend/dist
```

### Phase 8 — nginx reload

```bash
nginx -t && systemctl reload nginx
```

Configs unchanged unless manually updated; reload ensures clean state.

### Phase 9 — Smoke tests

Run `scripts/production-smoke-cert.mjs` against:

- API: `http://127.0.0.1:3000/api`
- Admin: `https://admin.emdadsy.com`
- Client: `https://client.emdadsy.com`

Modules: Authentication, RBAC, Products, Locations, Inventory, Inbound, Outbound, Returns, Cycle Count, Tasks, Reports, Billing, Backup, Client Portal.

### Phase 10 — Report

Generate `PRODUCTION-DEPLOYMENT-REPORT.md` with commit hash, duration, smoke results, rollback plan, URLs.

---

## 4. Rollback plan

If deployment fails after database migration:

1. Stop PM2: `pm2 stop emdad-wms-backend`
2. Restore database: `pg_restore -d wms_db --clean --if-exists <backup>/database/wms_db.dump`
3. Restore `.env` files from backup bundle
4. Checkout previous commit: `git checkout 29a578ae`
5. Rebuild backend + frontends from old tree
6. `pm2 start ecosystem.config.js` (previous fork config from backup `dump.pm2`)
7. `nginx -t && systemctl reload nginx`
8. Verify `https://admin.emdadsy.com` returns prior behavior

**Rollback window:** Before new migrations mutate data irreversibly — take DB backup first.

---

## 5. Success criteria

- [ ] All backups completed
- [ ] Production commit = `8cdc99f5`
- [ ] `GET /api/ops/health/live` → 200 on port 3000
- [ ] Admin + client SPAs load (HTTP 200)
- [ ] All smoke test modules PASS
- [ ] Staging environment unchanged and still online

---

## 6. Out of scope

- DNS changes (already pointed)
- Google Drive OAuth reconfiguration (remains disabled in UI)
- Payment gateway integration
- Decommissioning staging

---

*Plan only — execution documented in PRODUCTION-DEPLOYMENT-REPORT.md*
