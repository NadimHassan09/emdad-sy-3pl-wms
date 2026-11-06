# STAGING-DECOMMISSION-REPORT

**Executed:** 2026-06-12T17:05:29Z – 2026-06-12T17:07:00Z (UTC)  
**Audit reference:** [`STAGING-DECOMMISSION-AUDIT.md`](STAGING-DECOMMISSION-AUDIT.md)  
**Verdict:** **DECOMMISSION SUCCESSFUL** — production operational

---

## Executive Summary

Staging environment decommissioned per PHASE-CLOSE-1. Production at `admin.emdadsy.com` and `client.emdadsy.com` verified operational after cleanup. Staging PM2 processes, nginx vhosts, backup storage, and repository removed.

| Metric | Value |
|--------|------:|
| Staging PM2 processes removed | 2 |
| Staging nginx vhosts removed | 2 |
| Disk reclaimed (estimated) | **~1.27 GB** |
| Production health checks | **ALL PASS** |
| Production functionality modified | **NO** |

---

## 1. Deleted Resources

### 1.1 PM2 processes

| Process | Instances | Port | Action |
|---------|-----------|------|--------|
| `emdad-wms-backend-staging` | 2 | 3001 | **DELETED** |
| `emdad-wms-backend` | 1 | 3000 | **RETAINED** (production) |

```
[PM2] [emdad-wms-backend-staging](3) ✓
[PM2] [emdad-wms-backend-staging](4) ✓
[PM2] Successfully saved in /root/.pm2/dump.pm2
```

### 1.2 Nginx — removed files

| File | Action |
|------|--------|
| `/etc/nginx/sites-enabled/emdad-wms-staging-admin` | Deleted |
| `/etc/nginx/sites-enabled/emdad-wms-staging-client` | Deleted |
| `/etc/nginx/sites-available/emdad-wms-staging-admin` | Deleted |
| `/etc/nginx/sites-available/emdad-wms-staging-client` | Deleted |
| `/etc/nginx/snippets/emdad-wms-staging-backend-locations.conf` | Deleted |
| `/etc/nginx/conf.d/01-emdad-wms-staging-upstream.conf` | Deleted |
| `/etc/nginx/ssl/emdad-wms-staging/` | Deleted |

**Reload:** `nginx -t` → OK | `systemctl reload nginx` → OK

### 1.3 Staging backup storage

| Path | Size | Action |
|------|------:|--------|
| `/var/lib/emdad-wms/backups/staging` | 168 MB | **DELETED** |
| `/var/www/staging-backups/nginx-20260530` | 36 KB | **DELETED** |

### 1.4 Staging logs

| Path | Action |
|------|--------|
| `/var/log/nginx/emdad-staging-admin.*` | **DELETED** |
| `/var/log/nginx/emdad-staging-client.*` | **DELETED** |

### 1.5 Staging repository

| Path | Size | Action |
|------|------:|--------|
| `/var/www/emdad-sy-3pl-wms-staging/` | 1.1 GB | **DELETED** (post git push) |

Contents removed included:
- Duplicate `node_modules` (backend 514 MB, frontend 166 MB, client 132 MB)
- Duplicate `dist/` build artifacts
- Staging source tree and git clone

---

## 2. Preserved Resources (Production)

| Resource | Path / name | Reason |
|----------|-------------|--------|
| Production codebase | `/var/www/emdad-sy-3pl-wms/` | Live deployment |
| Production PM2 | `emdad-wms-backend` :3000 | Live API |
| Production nginx | `emdad-wms-admin`, `emdad-wms-client` | Live frontends |
| Production backups | `/var/lib/emdad-wms/backups/production/` | DR |
| Pre-deploy snapshot | `/var/www/staging-backups/production-deploy-20260612T135648Z/` | Production backup (122 MB) |
| Production database | `wms_db` (33 MB) | Live data |
| GitHub remote | `github.com/NadimHassan09/emdad-sy-3pl-wms` | Source of truth |

### Retained (optional future cleanup)

| Resource | Size | Note |
|----------|------|------|
| `wms_db_staging` | 52 MB | No production dependency; not dropped |
| `/var/www/emdad-sy-3pl-wms/emdad-sy-3pl-wms/` | 967 MB | Orphan nested copy; separate cleanup |

---

## 3. Reclaimed Disk Space

| Component removed | Size |
|-------------------|-----:|
| Staging repository | 1.1 GB |
| Staging backup storage | 168 MB |
| Staging nginx/ssl/logs | ~5 MB |
| **Total reclaimed** | **~1.27 GB** |

| Filesystem | Before | After |
|------------|--------|-------|
| `/dev/sda1` (96 GB) | 13 GB used (13%) | ~12 GB used (~12%) |

---

## 4. Remaining Production Services

| Service | Status | Endpoint |
|---------|--------|----------|
| Admin SPA | **ONLINE** | https://admin.emdadsy.com |
| Client SPA | **ONLINE** | https://client.emdadsy.com |
| Admin API | **ONLINE** | https://admin.emdadsy.com/api |
| Client API | **ONLINE** | https://client.emdadsy.com/api/client |
| Health (live) | **OK** | `/api/ops/health/live` |
| Health (ready) | **OK** | `/api/ops/health/ready` |
| PM2 backend | **online** | port 3000 |
| nginx | **healthy** | config test pass |
| PostgreSQL `wms_db` | **connected** | ready check: db ok |

---

## 5. Post-Cleanup Verification

**Evidence log:** `docs/evidence/staging-decommission/post-verification.log`

```
=== 2026-06-12T17:06:13Z Post-decommission verification ===

Health live:
{"success":true,"data":{"status":"ok","timestamp":"2026-06-12T17:06:13.368Z"}}

Health ready:
{"success":true,"data":{"status":"ok","checks":{"db":"ok","redis":"disabled","websocket":"ok","process":"ok","queues":"ok"}}}

Admin SPA:  HTTP 200 (62 ms)
Client SPA: HTTP 200 (63 ms)

PM2: emdad-wms-backend online

nginx: syntax ok, test successful
```

### Origin verification

| Host header (origin) | HTTP status |
|----------------------|-------------|
| `admin.emdadsy.com` | 301 → HTTPS (production vhost active) |
| `staging-admin.emdadsy.com` | 301 (no staging vhost — decommissioned) |

> **Note:** `staging-admin.emdadsy.com` may still return cached content via Cloudflare CDN until DNS records or Cloudflare cache are cleared. Origin nginx no longer serves staging.

---

## 6. Actions Not Performed

| Item | Reason |
|------|--------|
| Drop `wms_db_staging` | Out of scope; no production impact; optional manual drop |
| Remove Cloudflare staging DNS | Requires DNS panel access |
| Delete production-deploy backup bundle | Production DR asset — preserved |
| Modify production code/config | Per requirement: no production changes |

---

## 7. Follow-Up Recommendations

1. Remove Cloudflare/DNS records for `staging-admin.emdadsy.com` and `staging-client.emdadsy.com`.
2. Purge Cloudflare cache for staging subdomains.
3. Optionally drop `wms_db_staging` after 30-day retention.
4. Remove orphan `/var/www/emdad-sy-3pl-wms/emdad-sy-3pl-wms/` (967 MB) in separate cleanup.
5. Use GitHub `staging` branch + production tree `/var/www/emdad-sy-3pl-wms` for future deployments.

---

## 8. Sign-Off

| Check | Result |
|-------|--------|
| admin.emdadsy.com operational | ✅ |
| client.emdadsy.com operational | ✅ |
| API health endpoint operational | ✅ |
| PM2 healthy | ✅ |
| nginx healthy | ✅ |
| Production functionality unchanged | ✅ |

**STAGING DECOMMISSION COMPLETE**

---

*Report generated 2026-06-12 as part of PHASE-CLOSE-1.*
