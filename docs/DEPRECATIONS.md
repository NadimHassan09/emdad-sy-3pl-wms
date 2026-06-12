# API and code deprecations

**Last updated:** 2026-06-11 (production hardening audit)

This document records removed deprecated surfaces and remaining intentional legacy compatibility.

## Removed in production hardening (2026-06-11)

| Surface | Replacement |
|---------|-------------|
| `GET /api/locations/tree` | `GET /api/locations?warehouseId=&parentId=` + `GET /api/locations/lookup` |
| `GET /api/inventory/current-stock` | `GET /api/inventory/stock` |
| Report IDs `billing-revenue`, `billing-outstanding`, `billing-expiring`, `billing-suspended`, `billing-capacity` | Finance suite: `revenue-by-client`, `receivables-aging`; billing dashboard APIs under `/api/billing/*` |
| Client report runners (`report-runners.ts`, `warehouse-analysis.ts`, `generateReport`) | Server reports API `GET /api/reports/:id/*` |
| `ReportCategoryNav` component | `ReportsNav` + `REPORT_CATALOG` |
| `clientInboundListItem` / `clientOutboundListItem` realtime payloads | `adminInboundListItem` / `adminOutboundListItem` |
| `ledgerFilteredRowsCountSql` | `ledgerBusinessGroupsCountSql` |
| Frontend API helpers: `LocationsApi.tree`, `LocationsApi.list`, `InventoryApi.currentStock`, `WorkersApi.get` | See replacements above |

## Still deprecated but retained (runtime compatibility)

| Surface | Notes |
|---------|-------|
| `includeArchived` on location list/lookup DTOs | Migrate callers to `status` filter; still used by Locations page |
| Legacy scrypt password hashes | Upgraded to bcrypt on successful login |
| `parseDispatchTaskPayloadAllowLegacy` | Accepts older task completion payloads |
| Location type `qc` | Blocked for new locations; existing rows may remain |
| Router redirects `/inbound` → `/orders/inbound`, etc. | Bookmarks compatibility |
| `POST /inbound-orders/:id/lines/:lineId/receive` | Hidden when `TASK_ONLY_FLOWS=true`; remove when task-only is universal |

## Intentional non-UI APIs (not deprecated)

These endpoints have no admin UI but are used by ops, tests, or cron:

- `GET /api/analytics/overview`
- `GET /api/inventory/consistency/validate`
- `GET /api/audit-logs/archival-candidates`
- `GET/POST /api/ops/*`
- `POST /api/tasks/:id/fail`, `/reopen`
- `POST /api/workflow/instances/:instanceId/recover`
