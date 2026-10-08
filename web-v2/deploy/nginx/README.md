# Staging UI routing (applied on server)

Cookie switch (`emdad-ui-switch.conf` → `/etc/nginx/conf.d/02-emdad-ui-switch.conf`):

| Cookie | Admin root | Client root |
|--------|------------|-------------|
| *(none / default)* | `frontend/dist` (classic) | `client-frontend/dist` (classic) |
| `emdad_ui=v2` | `web-v2/apps/admin/dist` | `web-v2/apps/client/dist` |

## Domains

| Host | Default UI |
|------|------------|
| `staging-admin.emdadsy.com` | Classic admin (`frontend/dist`) |
| `staging-client.emdadsy.com` | Classic client (`client-frontend/dist`) |

To open web-v2 on the same domain, set cookie `emdad_ui=v2` (e.g. DevTools → Application → Cookies).

API/realtime still proxied to `emdad_wms_backend_staging` (`127.0.0.1:3001`).

## IP → classic staging frontend (kept)

| URL | Document root |
|-----|----------------|
| `https://<server-ip>/` (and `http://…` → HTTPS) | `/var/www/emdad-sy-3pl-wms-staging/frontend/dist` |
| `https://<server-ip>:8443/` | `/var/www/emdad-sy-3pl-wms-staging/client-frontend/dist` |

## Build before reload

```bash
# Classic
cd /var/www/emdad-sy-3pl-wms-staging/frontend && npm run build
cd /var/www/emdad-sy-3pl-wms-staging/client-frontend && npm run build

# web-v2 (optional, for cookie=v2)
cd /var/www/emdad-sy-3pl-wms-staging/web-v2
npm run build:admin && npm run build:client

nginx -t && systemctl reload nginx
```

Staging vhosts only — never edit production `admin.emdadsy.com` / `client.emdadsy.com` from this tree.
