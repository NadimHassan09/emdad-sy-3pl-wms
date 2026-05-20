# Reporting Center — Architecture Summary

## Overview

The `/reports` route is a **3PL WMS operational reporting workspace** inspired by Odoo Inventory reporting. It is **not** an ERP finance module: inventory is **client-owned**, and metrics focus on warehouse execution, fulfillment, and multi-tenant client activity.

## Architecture

```
ReportsPage
├── ReportCategoryNav      — horizontal category cards (Inventory / Fulfillment / Ops / Clients)
├── Toolbar                — date range, generate, CSV/Excel export, view mode (table/graph/pivot)
├── ReportFiltersPanel     — warehouse, client, status, SKU, employee, group-by
└── Workspace
    ├── ReportPreviewTable — dense sortable grid, sticky headers
    ├── ReportChartPanel   — bar + line SVG (no external chart library)
    └── ReportPivotPanel   — expandable grouped rows
```

**Data layer (current):** `registry.ts` → `report-engine.ts` → `report-runners.ts` → existing REST APIs (`/inventory/stock`, `/inventory/ledger`, `/inbound-orders`, `/outbound-orders`, `/tasks`, `/companies`, `/dashboard/overview`).

**Future:** `backend/src/modules/reports` with `GET /reports/:id/run` and server-side pagination/export jobs.

## Implemented reports (14)

| ID | Title | Category | Data source |
|----|-------|----------|-------------|
| `inventory-on-hand` | Inventory On Hand | Inventory | Stock API |
| `inventory-movement` | Inventory Movement | Inventory | Ledger API |
| `inbound-analysis` | Inbound Analysis | Fulfillment | Inbound orders |
| `outbound-analysis` | Outbound Analysis | Fulfillment | Outbound orders |
| `forecasted-inventory` | Forecasted Inventory | Inventory | Stock + open orders (client aggregation) |
| `warehouse-operations` | Warehouse Operations | Ops | Tasks API |
| `product-activity` | Product Activity | Inventory | Ledger aggregation |
| `worker-productivity` | Worker Productivity | Ops | Tasks API |
| `order-lifecycle` | Order Lifecycle | Fulfillment | Inbound + outbound lists |
| `sla-delay-analysis` | SLA / Delay Analysis | Fulfillment | Tasks + pending approvals (partial) |
| `capacity-utilization` | Capacity Utilization | Ops | Dashboard + stock |
| `inventory-aging` | Inventory Aging | Inventory | Stock / expiry buckets |
| `expiry-tracking` | Expiry Tracking | Inventory | Stock lots |
| `client-activity` | Client Activity | Clients | Companies + order counts |

## Shared components

| Component | Path |
|-----------|------|
| `ReportCategoryNav` | `frontend/src/components/reports/ReportCategoryNav.tsx` |
| `ReportFiltersPanel` | `frontend/src/components/reports/ReportFiltersPanel.tsx` |
| `ReportPreviewTable` | `frontend/src/components/reports/ReportPreviewTable.tsx` |
| `ReportChartPanel` | `frontend/src/components/reports/ReportChartPanel.tsx` |
| `ReportPivotPanel` | `frontend/src/components/reports/ReportPivotPanel.tsx` |
| `FilterPanel`, `DataTable`, `Combobox` | Existing admin list patterns |

## Lib modules

| Module | Role |
|--------|------|
| `types.ts` | Report definitions, filters, view modes |
| `registry.ts` | 14 report definitions + columns |
| `report-runners.ts` | API aggregation per report |
| `report-engine.ts` | `generateReport()` entry |
| `column-helpers.ts` | Column builders |
| `csv-export.ts` / `excel-export.ts` | Client exports |
| `chart-data.ts` / `pivot-helpers.ts` | Graph & pivot views |

## Missing backend endpoints

- `GET /reports` — catalog metadata
- `POST /reports/:id/run` — filtered server-side query with pagination
- `GET /reports/forecasted-inventory` — line-level projections
- `GET /reports/order-lifecycle` — state transition history
- `GET /reports/sla-delays` — SLA breach timestamps & escalation levels
- `POST /reports/:id/export` or async `report_jobs` for large exports

## Future analytics opportunities

- Real-time throughput dashboards (WebSocket)
- Dock door utilization & receiving SLA
- Pick path optimization metrics
- Client billing / storage-day charges (operational, not GL)
- Cross-warehouse client comparison

## Performance considerations

- Runners cap at **2,000 rows** per API call; large warehouses may truncate silently.
- SKU/employee filters are partly **client-side**.
- Graph/pivot views recompute in-browser on generated data.
- Prefer dedicated report queries with indexes on `inventory_ledger.created_at`, `company_id`, `warehouse_id`.

## Export system

- **CSV:** UTF-8 BOM for Excel Arabic compatibility (`csv-export.ts`).
- **Excel:** HTML table download as `.xls` without extra dependencies (`excel-export.ts`).
