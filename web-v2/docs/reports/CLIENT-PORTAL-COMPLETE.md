# Client portal V2 — complete

**Date:** 2026-10-06  
**App:** `@emdad/client` (`web-v2/apps/client`)  
**Dev:** http://127.0.0.1:5274

## Route status

| Status | Count |
|--------|------:|
| native | 30 |
| redirect | 6 |
| notMigrated | **0** |

`npx tsc` clean. `npm run check` pass (warnings only).

## Modules

- Dashboard (pre-existing)
- OMS: ecommerce orders list/create/detail, returns, COD (my-profits)
- WMS: products, inbound, outbound, outbound returns
- Account: billing, invoices, APIs, notifications, profile

## Note

Vite proxy uses `/api/` (trailing slash) so the SPA route `/apis` is not swallowed by the API proxy.
