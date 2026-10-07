# Staging UI routing (applied on server)

## Domains → new frontend (web-v2)

| Host | Document root |
|------|----------------|
| `staging-admin.emdadsy.com` | `/var/www/emdad-sy-3pl-wms-staging/web-v2/apps/admin/dist` |
| `staging-client.emdadsy.com` | `/var/www/emdad-sy-3pl-wms-staging/web-v2/apps/client/dist` |

API/realtime still proxied to `emdad_wms_backend_staging` (`127.0.0.1:3001`).

## IP → classic staging frontend (kept)

| URL | Document root |
|-----|----------------|
| `https://<server-ip>/` (and `http://…` → HTTPS) | `/var/www/emdad-sy-3pl-wms-staging/frontend/dist` |
| `https://<server-ip>:8443/` | `/var/www/emdad-sy-3pl-wms-staging/client-frontend/dist` |

Classic apps are **not** removed; they stay reachable by IP only.

## Build before reload

```bash
cd /var/www/emdad-sy-3pl-wms-staging/web-v2
npm run build:admin && npm run build:client
nginx -t && systemctl reload nginx
```

Staging vhosts only — never edit production `admin.emdadsy.com` / `client.emdadsy.com` from this tree.
