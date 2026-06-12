# Reporting framework — developer guide

Reusable server + client framework for WMS operational reports: shared template, filters, export, cache, and permissions.

## Architecture

```
Frontend                              Backend
────────                              ───────
ReportWorkspace                       ReportsController (@Roles ADMIN)
  └─ useReportFramework                 └─ ReportsService
       ├─ report-filters                    └─ ReportsFrameworkService
       ├─ report-cache                          ├─ report-registry.config
       ├─ report-export                         ├─ report-filters.util
       └─ report-permissions                    ├─ report-permissions.util
  └─ ReportPageTemplate (shell)                 ├─ ReportsCacheService
  └─ ReportFiltersPanel                         └─ ReportExportService
  └─ useReportServerData
```

## Backend — adding a report

1. **Register** in `backend/src/modules/reports/framework/report-registry.config.ts`:
   - `id`, `filterKeys`, `exportColumns`, `allowedRoles`
   - `requiresWarehouse`, `supportsKpis`, `supportsAggregate`

2. **Implement runner** in `ReportsService.executeRun()` (or a dedicated runner class like `BillingReportsRunner`).

3. **Aggregation** (optional): extend `groupRows()` if `supportsAggregate: true`.

4. Permissions are enforced via `ReportsFrameworkService.prepareQuery()` → `assertReportAccess()`.

### API endpoints (unchanged)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/reports/policy` | Limits, report IDs, cache TTL |
| `GET` | `/api/reports/:id/run` | Paginated preview |
| `GET` | `/api/reports/:id/aggregate` | Chart/pivot grouping |
| `GET` | `/api/reports/:id/kpis` | KPI strip (when supported) |
| `GET` | `/api/reports/:id/export` | CSV / XLS download |

### Shared cache

`ReportsCacheService` keys: `reports:{namespace}:{sha256(payload)}`  
TTL from `ReportsPolicyConfig.cacheTtlSec` (default 60s). Redis when enabled, else in-memory.

Namespaces: `run`, `aggregate`, `kpis`.

### Shared export

`ReportExportService.buildExport()` paginates through `executeRun` up to `exportMaxRows`, then formats via `reports-export.util`.

## Frontend — adding a report

1. **Catalog** — `frontend/src/lib/reports/report-catalog.ts` (route + titles).

2. **Registry** — `frontend/src/lib/reports/registry.ts`:
   - columns, `filterKeys`, views, chart keys, `serverSide: true`

3. **Route** — wire in `ReportsLayout` / router if new path.

4. **Permissions** — `canViewReport()` in `lib/reports/framework/report-permissions.ts` (align with backend `allowedRoles`).

Existing pages use `ReportWorkspace` which delegates to `useReportFramework` + `ReportPageTemplate` — no per-report page boilerplate.

## Shared filters

| Filter key | UI field | API param |
|------------|----------|-----------|
| `warehouse` | Warehouse select | `warehouseId` |
| `client` | Company combobox | `companyId` |
| `status` | Status / movement type | `status` |
| `sku` | SKU text | `sku` |
| `dateRange` | Date from / to | `dateFrom`, `dateTo` |
| `groupBy` | Group-by select | `groupBy` (aggregate) |

Helpers: `buildInitialReportFilters`, `filtersToApiParams`, `filtersToExportParams` (`lib/reports/framework/report-filters.ts`).

## Shared permissions

| Role | Reports access |
|------|----------------|
| `super_admin`, `wh_manager`, `finance` | All registered reports |
| `wh_operator` | Denied (controller + framework) |

## Testing

```bash
cd backend && npm run test:unit -- --testPathPattern=reports/framework
cd frontend && npm run build
```

## Policy snapshot example

`GET /api/reports/policy` returns `previewMaxLimit`, `exportMaxRows`, `cacheTtlSec`, and `reportIds` from the central registry.

## Operational suite (2026-06)

| Report ID | Runner |
|-----------|--------|
| `worker-productivity` | `OperationalReportsRunner` — completed tasks by worker |
| `order-cycle-time` | Inbound/outbound milestone hours |
| `inbound-accuracy` | Line-level received vs expected |
| `outbound-fill-rate` | Picked vs requested quantities |
| `sla-compliance` | SLA on-time / breach by task type |

Implement new operational metrics in `operational-reports.runner.ts`, register in `report-registry.config.ts`, and add catalog + `registry.ts` UI metadata on the frontend.
