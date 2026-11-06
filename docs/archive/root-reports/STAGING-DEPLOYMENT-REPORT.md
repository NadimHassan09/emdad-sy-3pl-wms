# Staging Deployment Report — EMDAD WMS

**Date:** 2026-05-30  
**Server IP:** 187.124.19.162  
**Branch deployed:** `extra_modules` (remote: `origin/extra_modules`)  
**Commit:** `26cb7116`

> **Branch name note:** The requested branch `extra-modules` (hyphen) does not exist on the remote. The matching branch is **`extra_modules`** (underscore). Staging was deployed from that branch.

---

## Production Status: **Healthy**

| Check | Result |
|-------|--------|
| `https://admin.emdadsy.com/` | HTTP 200 |
| `https://client.emdadsy.com/` | HTTP 200 |
| `https://admin.emdadsy.com/api/companies` | HTTP 401 (expected — auth required) |
| PM2 `emdad-wms-backend` | online, PID unchanged after staging operations |
| Production nginx configs | **Unmodified** (verified via diff against pre-change backup) |

---

## Staging Status: **Healthy** (pending public DNS)

| Check | Result |
|-------|--------|
| Backend direct `http://127.0.0.1:3001/api/companies` | HTTP 401 |
| Nginx admin (Host header test) | HTTP 200 |
| Nginx client (Host header test) | HTTP 200 |
| Nginx API proxy (Host header test) | HTTP 401 |
| PM2 `emdad-wms-backend-staging` | online |
| Public HTTPS via domain | **Blocked** — DNS records not configured (NXDOMAIN) |

Staging is fully functional on the server. External access requires DNS A/AAAA records pointing to `187.124.19.162`.

---

## 1. Production Architecture (Discovered)

### Application Layout

| Component | Path |
|-----------|------|
| Production root | `/var/www/emdad-sy-3pl-wms` |
| Admin frontend (built) | `/var/www/emdad-sy-3pl-wms/frontend/dist` |
| Client frontend (built) | `/var/www/emdad-sy-3pl-wms/client-frontend/dist` |
| Backend source + build | `/var/www/emdad-sy-3pl-wms/backend` |
| Backend entrypoint | `backend/dist/src/main.js` |

### Process Manager

- **PM2** (fork mode, single instance)
- Process name: `emdad-wms-backend`
- Config: `/var/www/emdad-sy-3pl-wms/ecosystem.config.js`
- Logs: `/var/log/emdad-wms/backend-out.log`, `/var/log/emdad-wms/backend-err.log`
- PM2 startup: enabled (`pm2-root` systemd unit)

### Reverse Proxy

- **nginx** (systemd service, active)
- Upstream: `emdad_wms_backend` → `127.0.0.1:3000`
- Shared snippet: `/etc/nginx/snippets/emdad-wms-backend-locations.conf`
- Proxied paths: `/api/`, `/realtime/`, `/socket.io/`

### Domains & Ports

| Domain | Role | Backend Port |
|--------|------|--------------|
| `admin.emdadsy.com` | Admin SPA + API proxy | 3000 |
| `client.emdadsy.com` | Client portal SPA + API proxy | 3000 |
| nginx | 80 (→ HTTPS redirect), 443 | — |
| PostgreSQL | `127.0.0.1:5432` | — |

### SSL (Production)

- Certificate: `/etc/nginx/ssl/emdad-wms/emdad-wms.crt`
- SANs: `admin.emdadsy.com`, `client.emdadsy.com`
- Valid: 2026-05-11 → 2028-08-13

### Database (Production)

- Database: `wms_db`
- User: `wms_user`
- Size: ~32 MB

### Environment Files (Production)

| File | Purpose |
|------|---------|
| `/var/www/emdad-sy-3pl-wms/backend/.env` | Backend runtime |
| `/var/www/emdad-sy-3pl-wms/frontend/.env` | Admin build-time (optional) |
| `/var/www/emdad-sy-3pl-wms/client-frontend/.env` | Client build-time |

### Docker

- Docker engine installed but **no WMS containers running**. Deployment is bare-metal PM2 + nginx.

---

## 2. Staging Architecture (Created)

### Isolation Summary

Staging is fully isolated from production:

| Resource | Production | Staging |
|----------|------------|---------|
| Code directory | `/var/www/emdad-sy-3pl-wms` | `/var/www/emdad-sy-3pl-wms-staging` |
| Git branch | `main` | `extra_modules` |
| Backend port | 3000 | **3001** |
| PM2 process | `emdad-wms-backend` | `emdad-wms-backend-staging` |
| Database | `wms_db` | **`wms_db_staging`** (clone) |
| nginx upstream | `emdad_wms_backend` | **`emdad_wms_backend_staging`** |
| Logs | `/var/log/emdad-wms/` | `/var/log/emdad-wms-staging/` |
| SSL cert | `/etc/nginx/ssl/emdad-wms/` | `/etc/nginx/ssl/emdad-wms-staging/` |

No production files, processes, ports, or databases were modified or restarted.

### Directories Created

```
/var/www/emdad-sy-3pl-wms-staging/          # Full git clone (extra_modules)
/var/log/emdad-wms-staging/                  # Staging backend logs
/var/www/staging-backups/nginx-20260530/     # Pre-change nginx config backup
/etc/nginx/conf.d/01-emdad-wms-staging-upstream.conf
/etc/nginx/snippets/emdad-wms-staging-backend-locations.conf
/etc/nginx/sites-available/emdad-wms-staging-admin
/etc/nginx/sites-available/emdad-wms-staging-client
/etc/nginx/sites-enabled/emdad-wms-staging-admin   → symlink
/etc/nginx/sites-enabled/emdad-wms-staging-client  → symlink
/etc/nginx/ssl/emdad-wms-staging/            # Self-signed TLS cert + key
```

### Staging Domains (Configured in nginx)

Production uses two portals (`admin` + `client`). Staging mirrors this pattern:

| Domain | Role |
|--------|------|
| `staging-admin.emdadsy.com` | Admin SPA + API proxy → port 3001 |
| `staging-client.emdadsy.com` | Client portal SPA + API proxy → port 3001 |

> The example `staging.emdadsy.com` is included as a SAN on the staging certificate but no vhost serves it directly. A landing/redirect page can be added later if desired.

### Ports Used

| Port | Service |
|------|---------|
| 3000 | Production backend (unchanged) |
| **3001** | Staging backend (new) |
| 80 / 443 | nginx (shared listener; vhost routing by `server_name`) |
| 5432 | PostgreSQL (shared instance; separate database) |

### Process Manager (Staging)

- **PM2** process: `emdad-wms-backend-staging`
- Config: `/var/www/emdad-sy-3pl-wms-staging/ecosystem.staging.config.js`
- CWD: `/var/www/emdad-sy-3pl-wms-staging/backend`
- Script: `dist/src/main.js`
- Logs: `/var/log/emdad-wms-staging/backend-out.log`, `backend-err.log`
- Saved to PM2 dump (`pm2 save`) for persistence across reboots

### Environment Files (Staging)

| File | Notes |
|------|-------|
| `backend/.env` | Port 3001, `wms_db_staging`, staging CORS origins, distinct JWT secrets, `REDIS_ENABLED=false` |
| `frontend/.env` | Same-origin API (no `VITE_API_URL`; nginx proxies `/api`) |
| `client-frontend/.env` | Same-origin API (no `VITE_API_URL`; nginx proxies `/api/client`) |
| `ecosystem.staging.config.js` | PM2 definition |

Secrets are **not** copied from production JWT values. Staging uses independently generated secrets.

### Database Configuration

| Item | Value |
|------|-------|
| Staging database | `wms_db_staging` |
| Clone source | `wms_db` (production database) |
| Clone method | `pg_dump -Fc` → `pg_restore --clean --if-exists --no-owner --no-acl` |
| Staging DB size | ~30 MB |
| Migrations | Prisma migrations from `extra_modules` applied successfully |
| User | `wms_user` (same PostgreSQL role; separate database) |

**Isolation confirmed:** Staging reads/writes only `wms_db_staging`. Production `wms_db` was not modified.

### SSL Status (Staging)

| Item | Status |
|------|--------|
| Certificate type | **Self-signed** (365-day validity) |
| Path | `/etc/nginx/ssl/emdad-wms-staging/staging.crt` + `staging.key` |
| SANs | `staging-admin.emdadsy.com`, `staging-client.emdadsy.com`, `staging.emdadsy.com` |
| Let's Encrypt | **Not issued** — DNS records do not exist (certbot dry-run failed with NXDOMAIN) |

Once DNS is configured, run:

```bash
certbot certonly --webroot -w /var/www/certbot \
  -d staging-admin.emdadsy.com -d staging-client.emdadsy.com \
  --non-interactive --agree-tos --register-unsafely-without-email
```

Then update the `ssl_certificate` / `ssl_certificate_key` paths in the staging nginx vhosts and reload nginx.

### File Uploads / Storage

No dedicated filesystem upload directory was found in the backend configuration. The WMS stores data in PostgreSQL. No shared upload paths exist between production and staging.

---

## 3. Configuration Backups

Before any nginx changes, production configs were copied to:

```
/var/www/staging-backups/nginx-20260530/
├── 00-emdad-wms-upstream.conf
├── emdad-wms-admin
├── emdad-wms-client
└── emdad-wms-backend-locations.conf
```

Post-deployment diff confirms production nginx files are **byte-identical** to the backup.

---

## 4. Verification Results

### Production Unaffected

- Production PM2 PID (`669694`) remained unchanged after staging restart
- Production HTTP endpoints return expected responses
- Production nginx vhosts and upstream config not modified
- Production backend never restarted during this deployment

### Staging Independent

- Staging backend listens on port **3001** (separate from 3000)
- Staging PM2 restart does not affect production process
- Staging uses separate database, logs, code tree, and nginx upstream
- Staging API returns 401 (same auth behavior as production)

### Isolation Test: Restart Staging

```
Prod PID before staging restart: 669694
Prod PID after staging restart:  669694  ✓ unchanged
Production HTTPS after restart:  200     ✓
Staging API after restart:       401     ✓
```

---

## 5. Risks Found

| Risk | Severity | Details |
|------|----------|---------|
| **DNS not configured** | High (external access) | `staging-admin.emdadsy.com`, `staging-client.emdadsy.com`, and `staging.emdadsy.com` all return NXDOMAIN. Staging works locally but is unreachable from the internet. |
| **Self-signed TLS** | Medium | Browsers will show certificate warnings until Let's Encrypt certs are issued. |
| **Node.js version** | Medium | Server runs Node **v20.18.2**; Vite 8 / `extra_modules` client-frontend requires **≥20.19**. Build succeeded after manually installing `@rolldown/binding-linux-x64-gnu`. Future `npm ci` may fail without this workaround or a Node upgrade. |
| **Shared PostgreSQL instance** | Low | Databases are isolated (`wms_db` vs `wms_db_staging`) but share one PostgreSQL server. A PostgreSQL-level incident would affect both. |
| **Shared nginx listener** | Low | Both environments share ports 80/443 on the same nginx instance. Vhost routing is by `server_name`; misconfiguration could theoretically cross-route, but configs use distinct upstreams and roots. |
| **Staging data is a production clone** | Low | `wms_db_staging` contains a snapshot of production data as of clone time. Treat staging credentials/data as sensitive. |
| **Production CORS includes localhost** | Info | Production `.env` still lists localhost in `CORS_ORIGINS`. The `extra_modules` branch blocks this in production mode; production runs older `main` code where this check may not exist. |

---

## 6. Recommendations

1. **Add DNS records** in Cloudflare (or your DNS provider):
   - `staging-admin.emdadsy.com` → A `187.124.19.162`
   - `staging-client.emdadsy.com` → A `187.124.19.162`
   - Optionally: `staging.emdadsy.com` → A `187.124.19.162`

2. **Issue Let's Encrypt certificates** once DNS propagates (see command above), then update nginx SSL paths.

3. **Upgrade Node.js** to ≥20.19 or ≥22.12 LTS to avoid rolldown/Vite build failures on future staging deploys. Use a version manager or install alongside current Node to avoid disrupting production until tested.

4. **Document staging deploy procedure:**
   ```bash
   cd /var/www/emdad-sy-3pl-wms-staging
   git fetch origin && git checkout extra_modules && git pull
   cd backend && npm ci && npm run db:generate && npm run build && npm run db:migrate
   cd ../frontend && npm ci && npm run build
   cd ../client-frontend && npm ci && npm run build
   pm2 restart emdad-wms-backend-staging
   # nginx reload only needed if static assets paths change
   ```

5. **Refresh staging database periodically** if you need current production data:
   ```bash
   sudo -u postgres pg_dump -Fc wms_db | sudo -u postgres pg_restore -d wms_db_staging --clean --if-exists --no-owner --no-acl
   cd /var/www/emdad-sy-3pl-wms-staging/backend && npm run db:migrate
   ```
   Schedule this during low-traffic windows; it does not affect production runtime.

6. **Consider Redis** for staging if testing Socket.IO clustering or task read cache — currently `REDIS_ENABLED=false` because Redis is not running on this server.

7. **Add `X-Environment: staging` response header** in staging nginx (optional) to help distinguish environments during testing.

---

## 7. Quick Reference

### Manage Staging Backend

```bash
pm2 status emdad-wms-backend-staging
pm2 restart emdad-wms-backend-staging
pm2 logs emdad-wms-backend-staging
```

### Manage Production Backend (unchanged)

```bash
pm2 status emdad-wms-backend
# Do NOT restart unless intentionally deploying production
```

### nginx

```bash
sudo nginx -t && sudo systemctl reload nginx
```

### Staging Logs

```bash
tail -f /var/log/emdad-wms-staging/backend-out.log
tail -f /var/log/nginx/emdad-staging-admin.access.log
tail -f /var/log/nginx/emdad-staging-client.access.log
```

---

## 8. Summary

| | Production | Staging |
|---|-----------|---------|
| **Status** | **Healthy** | **Healthy** (local); DNS pending for public access |
| **Directory** | `/var/www/emdad-sy-3pl-wms` | `/var/www/emdad-sy-3pl-wms-staging` |
| **Branch** | `main` | `extra_modules` |
| **Backend port** | 3000 | 3001 |
| **Database** | `wms_db` | `wms_db_staging` |
| **Admin URL** | `https://admin.emdadsy.com` | `https://staging-admin.emdadsy.com` |
| **Client URL** | `https://client.emdadsy.com` | `https://staging-client.emdadsy.com` |
| **SSL** | Valid (admin + client SANs) | Self-signed (pending DNS + Let's Encrypt) |
| **PM2 process** | `emdad-wms-backend` | `emdad-wms-backend-staging` |

Production was not modified, redeployed, restarted, or overwritten during this staging deployment.
