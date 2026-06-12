# Reporting center

> **Note:** This document was superseded by the server-side reporting framework (2026-06). Use [`docs/REPORTING-FRAMEWORK.md`](../REPORTING-FRAMEWORK.md) for current architecture.

## Current architecture

- **Navigation:** `ReportsNav` driven by `REPORT_CATALOG` (`lib/reports/report-catalog.ts`)
- **UI shell:** `ReportWorkspace` → `useReportFramework` → `useReportServerData`
- **Execution:** `GET /api/reports/:id/run|aggregate|export|kpis` (server-side only)
- **Registry:** `lib/reports/registry.ts` holds columns, filters, and view metadata — no client `run` functions

## Live reports (14)

| Section | Reports |
|---------|---------|
| Operations | warehouse-analysis, worker-productivity, order-cycle-time, inbound-accuracy, outbound-fill-rate, sla-compliance |
| Inventory | inventory, product-moves, stock-aging, lot-expiry, capacity-utilization, return-rate |
| Finance | revenue-by-client, receivables-aging |

## Removed legacy patterns

- `ReportCategoryNav` — deleted
- `report-runners.ts` client bulk fetch — deleted
- `generateReport()` — deleted; use `ReportsApi.run`
