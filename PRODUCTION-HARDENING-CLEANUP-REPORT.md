# Production hardening cleanup report

**Date:** 2026-06-11  
**Branch:** `staging`  
**Scope:** Remove deprecated endpoints, dead code, unused APIs/components; document deprecations; verify no frontend references remain.

---

## Summary

| Category | Items removed | Verified |
|----------|---------------|----------|
| Backend endpoints | 2 (`/locations/tree`, `/inventory/current-stock` alias) | No frontend callers |
| Backend report IDs | 5 (`billing-*`) | Superseded by finance suite + billing module |
| Backend dead code | 3 files/functions | Grep + unit tests |
| Frontend dead code | 5 files (~27 KB) | Build + grep |
| Frontend unused API helpers | 4 methods | Zero references |
| Documentation | 3 updated, 2 created | Architecture aligned with code |

---

## Backend removals

### Deprecated endpoints removed

1. **`GET /api/locations/tree`** — returned full in-memory warehouse tree (up to ~1.8 MB). Replaced by paginated `GET /locations` + `lookup`.
2. **`GET /api/inventory/current-stock`** — alias of `/inventory/stock`; frontend already used `/stock` only.

### Unused report API surface removed

Removed five backend-only billing report IDs (no admin UI, no frontend catalog):

- `billing-revenue` → use `revenue-by-client`
- `billing-outstanding` → use `receivables-aging`
- `billing-expiring`, `billing-suspended`, `billing-capacity` → billing dashboard `/api/billing/*`

Deleted `billing-reports.runner.ts` and registry entries.

### Other backend cleanup

- `clientInboundListItem` / `clientOutboundListItem` — zero references
- `ledgerFilteredRowsCountSql` — diagnostic alias, unused
- `REPORT_IDS` constant in `run-report-query.dto.ts` — stale (3 IDs); validation uses `report-registry.config.ts`
- `LocationTreeNode` builder in `locations.service.ts` (tree method only)

---

## Frontend removals

### Deleted files

| File | Reason |
|------|--------|
| `components/reports/ReportCategoryNav.tsx` | Replaced by `ReportsNav` |
| `lib/reports/report-runners.ts` | Client-side 2000-row fetch; all reports server-side |
| `lib/reports/warehouse-analysis.ts` | KPIs/chart via `GET /reports/:id/kpis` and `run` |
| `pages/tasks/putaway/usePutawayResolvedLocations.ts` | Re-export shim; import `useResolvedLocations` directly |

### Simplified modules

- **`report-engine.ts`** — kept `sortReportRows` only; removed `generateReport`
- **`types.ts`** — removed `ReportCategory`, `REPORT_CATEGORY_META`, `run`, `ReportGenerateResult`, `ReportRunContext`
- **`registry.ts`** — metadata only (columns, filters, views); removed all `run:` and `category:` fields

### Unused API helpers removed

| Method | File |
|--------|------|
| `LocationsApi.tree()` | `api/locations.ts` |
| `LocationsApi.list()` | `api/locations.ts` |
| `InventoryApi.currentStock()` | `api/inventory.ts` |
| `WorkersApi.get()` | `api/workers.ts` |
| `ledgerReferenceDetailPath()` | `lib/ledger-display.ts` |

### Query keys removed

- `QK.locationsTree`
- `QK.locationsFlat`

---

## Verification

### No frontend references (grep)

```
ReportCategoryNav          → 0 imports
report-runners             → 0 imports
generateReport             → 0 imports
/locations/tree            → 0 (API client removed)
/inventory/current-stock   → 0 (API client removed)
billing-revenue            → 0 in frontend
```

### Automated checks

```bash
cd backend && npm run test:unit -- --testPathPattern=reports
cd frontend && npm run build
```

---

## Documentation updates

| Document | Change |
|----------|--------|
| `docs/DEPRECATIONS.md` | **New** — removed vs retained deprecations |
| `SYSTEM-ARCHITECTURE.md` | Reports flow, API catalog, risks R-13/R-14 resolved |
| `docs/REPORTING-FRAMEWORK.md` | Already current (reference for report dev) |
| `tests/helpers/endpoint-catalog.ts` | Removed `/locations/tree` entry |

---

## Intentionally not removed

- Location `includeArchived` query param (still used by Locations page)
- Legacy password scrypt upgrade path
- Inbound line receive API (task-only mode conditional)
- Ops/diagnostic endpoints (analytics, consistency validate, archival-candidates)
- Design-system re-exports (`FilterPanel`, `modal-button-styles`) — pending DS migration

---

## Manual QA checklist

- [ ] Locations page: tree navigation, lookup, create/edit still work
- [ ] Inventory stock list and reports inventory report
- [ ] All 14 reports generate, export, cache
- [ ] Putaway task execution resolves locations
- [ ] Finance reports (revenue-by-client, receivables-aging)
