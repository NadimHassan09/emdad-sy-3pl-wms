# RunReportQueryDto

> 126 nodes · cohesion 0.04

## Key Concepts

- **RunReportQueryDto** (64 connections) — `backend/src/modules/reports/dto/run-report-query.dto.ts`
- **reports.service.ts** (44 connections) — `backend/src/modules/reports/reports.service.ts`
- **ReportsService** (22 connections) — `backend/src/modules/reports/reports.service.ts`
- **finance-reports.runner.ts** (20 connections) — `backend/src/modules/reports/finance-reports.runner.ts`
- **OmsReportsRunner** (18 connections) — `backend/src/modules/reports/oms-reports.runner.ts`
- **OperationalReportsRunner** (17 connections) — `backend/src/modules/reports/operational-reports.runner.ts`
- **ReportsFrameworkService** (14 connections) — `backend/src/modules/reports/framework/reports-framework.service.ts`
- **InventoryIntelligenceReportsRunner** (14 connections) — `backend/src/modules/reports/inventory-intelligence-reports.runner.ts`
- **FinanceReportsRunner** (13 connections) — `backend/src/modules/reports/finance-reports.runner.ts`
- **.prepareQuery()** (13 connections) — `backend/src/modules/reports/framework/reports-framework.service.ts`
- **.constructor()** (13 connections) — `backend/src/modules/reports/reports.service.ts`
- **.executeRun()** (13 connections) — `backend/src/modules/reports/reports.service.ts`
- **.list()** (12 connections) — `backend/src/modules/inbound/inbound.service.ts`
- **.run()** (12 connections) — `backend/src/modules/reports/oms-reports.runner.ts`
- **.lotExpiry()** (11 connections) — `backend/src/modules/reports/inventory-intelligence-reports.runner.ts`
- **.stockAging()** (11 connections) — `backend/src/modules/reports/inventory-intelligence-reports.runner.ts`
- **.companyFilter()** (11 connections) — `backend/src/modules/reports/oms-reports.runner.ts`
- **ReportsController** (11 connections) — `backend/src/modules/reports/reports.controller.ts`
- **.export()** (11 connections) — `backend/src/modules/reports/reports.controller.ts`
- **.receivablesAging()** (10 connections) — `backend/src/modules/reports/finance-reports.runner.ts`
- **.run()** (10 connections) — `backend/src/modules/reports/operational-reports.runner.ts`
- **.stock()** (9 connections) — `backend/src/modules/inventory/inventory.service.ts`
- **AggregateReportQueryDto** (9 connections) — `backend/src/modules/reports/dto/run-report-query.dto.ts`
- **ExportReportQueryDto** (9 connections) — `backend/src/modules/reports/dto/run-report-query.dto.ts`
- **.run()** (9 connections) — `backend/src/modules/reports/inventory-intelligence-reports.runner.ts`
- *... and 101 more nodes in this community*

## Relationships

- [AuthPrincipal](AuthPrincipal.md) (53 shared connections)
- [@prisma/client](@prisma-client.md) (48 shared connections)
- [inventory.service.ts](inventory.service.ts.md) (11 shared connections)
- [EmptyToUndefined](EmptyToUndefined.md) (10 shared connections)
- [report-export.service.ts](report-export.service.ts.md) (10 shared connections)
- [reports-framework.service.ts](reports-framework.service.ts.md) (10 shared connections)
- [app.module.ts](app.module.ts.md) (10 shared connections)
- [warehouse-tasks.controller.ts](warehouse-tasks.controller.ts.md) (6 shared connections)
- [CurrentUser](CurrentUser.md) (5 shared connections)
- [.fromPrincipal](fromPrincipal.md) (4 shared connections)
- [withTenantRls](withTenantRls.md) (4 shared connections)
- [dashboard.service.ts](dashboard.service.ts.md) (4 shared connections)

## Source Files

- `backend/src/modules/inbound/inbound.service.ts`
- `backend/src/modules/inventory/inventory.service.ts`
- `backend/src/modules/reports/dto/run-report-query.dto.ts`
- `backend/src/modules/reports/finance-reports.runner.ts`
- `backend/src/modules/reports/finance-reports.runner.unit.spec.ts`
- `backend/src/modules/reports/framework/report-export.service.ts`
- `backend/src/modules/reports/framework/reports-framework.service.ts`
- `backend/src/modules/reports/inventory-intelligence-reports.runner.ts`
- `backend/src/modules/reports/inventory-intelligence-reports.runner.unit.spec.ts`
- `backend/src/modules/reports/oms-reports.runner.ts`
- `backend/src/modules/reports/oms-reports.runner.unit.spec.ts`
- `backend/src/modules/reports/operational-reports.runner.ts`
- `backend/src/modules/reports/operational-reports.runner.unit.spec.ts`
- `backend/src/modules/reports/reports.controller.ts`
- `backend/src/modules/reports/reports.service.ts`

## Audit Trail

- EXTRACTED: 482 (93%)
- INFERRED: 38 (7%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*