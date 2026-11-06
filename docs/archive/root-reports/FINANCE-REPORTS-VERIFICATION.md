# Finance reporting suite — verification

**Date:** 2026-06-11  
**Branch:** `staging`

## Reports delivered

| ID | Title | Metrics |
|----|-------|---------|
| `revenue-by-client` | Revenue by Client | Invoice count and total revenue per client |
| `receivables-aging` | Receivables Aging | Open/overdue invoices by days-past-due bucket |

## Framework integration

- Registered in `report-registry.config.ts` with export columns and filter keys
- Uses shared cache, export, permissions (`super_admin`, `wh_manager`, `finance`)
- No warehouse required — finance reports are tenant-wide
- Frontend: `ReportWorkspace` + `FinanceReportPages.tsx`

## Automated checks

```bash
cd backend && npm run test:unit -- --testPathPattern=finance-reports
cd frontend && npm run build
```

## Manual QA

- [ ] Open **Revenue by Client** and **Receivables Aging** from Reports nav
- [ ] Filter by client, date range (revenue), invoice status / aging bucket
- [ ] Export CSV and Excel for each report
- [ ] Repeat generate — confirm cached banner (server TTL 60s)
- [ ] Graph and pivot views with group-by
