# Operational reporting suite — verification

**Date:** 2026-06-11  
**Branch:** `staging`

## Reports delivered

| ID | Title | Metrics |
|----|-------|---------|
| `worker-productivity` | Worker Productivity | Completed tasks, types, avg cycle hours per worker |
| `order-cycle-time` | Order Cycle Time | Inbound confirmed→completed, outbound confirmed→shipped (hours) |
| `inbound-accuracy` | Inbound Accuracy | Line discrepancies, received/expected accuracy % |
| `outbound-fill-rate` | Outbound Fill Rate | Picked vs requested qty, short-ship flag |
| `sla-compliance` | SLA Compliance | On-time vs breached tasks by type, escalations |

## Framework integration

- Registered in `report-registry.config.ts` with export columns and filter keys
- Uses shared cache (`ReportsFrameworkService.runCached`), export (`ReportExportService`), permissions, and filters
- Frontend: `ReportWorkspace` + `useReportFramework` (no custom page boilerplate)

## Automated checks

```bash
cd backend && npm run test:unit -- --testPathPattern=operational-reports
cd backend && npm run test:unit -- --testPathPattern=reports/framework
cd frontend && npm run build
```

## Manual QA

- [ ] Open each report under **Reports** nav, generate with warehouse + date range
- [ ] Export CSV and Excel for each report
- [ ] Repeat generate — confirm cached banner (server TTL 60s)
- [ ] Filter by client and task type (worker productivity / SLA)
- [ ] Graph and pivot views with group-by
