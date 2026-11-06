# Inventory intelligence reporting suite — verification

## Reports

| ID | Route | Data source |
|----|-------|-------------|
| `stock-aging` | `/reports/stock-aging` | `current_stock.last_movement_at` |
| `lot-expiry` | `/reports/lot-expiry` | `lots.expiry_date` on stocked lots |
| `capacity-utilization` | `/reports/capacity-utilization` | Active storage locations vs occupied |
| `return-rate` | `/reports/return-rate` | `return_orders` vs outbound in date range |

## Framework features

- **Filters**: warehouse (required), client, SKU, aging/expiry bucket (`status`), date range (return rate)
- **Export**: CSV/XLS via `GET /api/reports/:id/export`
- **Cache**: 60s TTL via `ReportsCacheService` (`run`, `aggregate` namespaces)
- **Aggregate**: `groupBy` pivot/chart via `GET /api/reports/:id/aggregate`
- **Permissions**: `super_admin`, `wh_manager`, `finance`

## Backend

- Runner: `backend/src/modules/reports/inventory-intelligence-reports.runner.ts`
- Registry: `backend/src/modules/reports/framework/report-registry.config.ts`
- Tests: `backend/src/modules/reports/inventory-intelligence-reports.runner.unit.spec.ts`

## Frontend

- Catalog: `frontend/src/lib/reports/report-catalog.ts`
- Registry: `frontend/src/lib/reports/registry.ts`
- Pages: `frontend/src/pages/reports/InventoryIntelligenceReportPages.tsx`
- Routes: `frontend/src/router.tsx` under `/reports/*`

## Verification commands

```bash
cd backend && npm run test:unit -- --testPathPattern=inventory-intelligence
cd frontend && npm run build
```

## Manual smoke checklist

- [ ] Open each report from Reports nav (inventory section)
- [ ] Select warehouse and generate preview
- [ ] Apply client / SKU / bucket filters
- [ ] Switch table / graph / pivot views
- [ ] Export CSV and XLS
- [ ] Confirm cached badge on repeat generate within TTL
