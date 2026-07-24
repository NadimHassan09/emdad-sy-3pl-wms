# Staging Redeployment Report

**Date:** 2026-07-24  
**Branch:** `staging`  
**Status:** Healthy and isolated from production

## Domains

| Domain | Role |
|--------|------|
| `staging-admin.emdadsy.com` | Admin SPA + API |
| `staging-client.emdadsy.com` | Client portal SPA + API |

## Isolation map

| Resource | Production | Staging |
|----------|------------|---------|
| Path | `/var/www/emdad-sy-3pl-wms` | `/var/www/emdad-sy-3pl-wms-staging` |
| Git deploy branch | `main` | `staging` |
| Backend port | 3000 | 3001 |
| PM2 | `emdad-wms-backend` | `emdad-wms-backend-staging` |
| Database | `wms_db` | `wms_db_staging` |
| Backups | `/var/lib/emdad-wms/backups/production` | `/var/lib/emdad-wms/backups/staging` |
| Logs | `/var/log/emdad-wms/` | `/var/log/emdad-wms-staging/` |
| SSL | `/etc/nginx/ssl/emdad-wms/` | `/etc/nginx/ssl/emdad-wms-staging/` |
| GHA workflow | `deploy.yml` (main only) | `deploy-staging.yml` (staging only) |

## Verification (2026-07-24)

- Staging admin/client HTTPS 200 (origin Host-header + Cloudflare)
- Staging `/api/ops/health/ready` → db ok, websocket ok
- Staging admin login (`superadmin@emdad.example` / `demo123`) works
- Staging companies API returns 6 clients (including Madino)
- Socket.IO polling 200 on staging host
- Production admin/client 200; prod PM2 PIDs unchanged; prod `.env` / nginx checksums unchanged

## Notes

- Staging JWT secrets are independent from production.
- Staging TLS uses a self-signed origin cert (Cloudflare currently returns 200).
- Client portal passwords are cloned from production hashes; use known client credentials (seed `demo123` may not apply to all client users).
- Production tree may still be checked out on `staging` until the next `main` deploy; runtime isolation is by path/port/DB/PM2, not by that checkout alone.
