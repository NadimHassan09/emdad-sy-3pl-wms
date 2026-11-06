# @prisma/client

> 257 nodes · cohesion 0.02

## Key Concepts

- **@prisma/client** (329 connections) — `backend/package.json`
- **PrismaService** (273 connections) — `backend/src/common/prisma/prisma.service.ts`
- **current-user.types.ts** (145 connections) — `backend/src/common/auth/current-user.types.ts`
- **prisma.service.ts** (144 connections) — `backend/src/common/prisma/prisma.service.ts`
- **CompanyAccessService** (118 connections) — `backend/src/common/company-access/company-access.service.ts`
- **company-access.service.ts** (75 connections) — `backend/src/common/company-access/company-access.service.ts`
- **oms-returns.service.ts** (75 connections) — `backend/src/modules/oms-returns/oms-returns.service.ts`
- **billing.module.ts** (49 connections) — `backend/src/modules/billing/billing.module.ts`
- **billing.controller.ts** (46 connections) — `backend/src/modules/billing/billing.controller.ts`
- **users.service.ts** (46 connections) — `backend/src/modules/users/users.service.ts`
- **auth.service.ts** (43 connections) — `backend/src/modules/auth/auth.service.ts`
- **billing-plans.service.ts** (43 connections) — `backend/src/modules/billing/billing-plans.service.ts`
- **cod-records.service.ts** (43 connections) — `backend/src/modules/cod/cod-records.service.ts`
- **company-read-scope.ts** (30 connections) — `backend/src/common/auth/company-read-scope.ts`
- **billing-invoices.service.ts** (30 connections) — `backend/src/modules/billing/billing-invoices.service.ts`
- **inventory-intelligence-reports.runner.ts** (29 connections) — `backend/src/modules/reports/inventory-intelligence-reports.runner.ts`
- **client-billing.service.ts** (28 connections) — `backend/src/modules/client-portal/billing/client-billing.service.ts`
- **documents.service.ts** (28 connections) — `backend/src/pdf/documents.service.ts`
- **readCompanyIdCatalogFilter()** (27 connections) — `backend/src/common/auth/company-read-scope.ts`
- **companies.service.ts** (27 connections) — `backend/src/modules/companies/companies.service.ts`
- **operational-reports.runner.ts** (27 connections) — `backend/src/modules/reports/operational-reports.runner.ts`
- **tenant-rls.ts** (26 connections) — `backend/src/common/prisma/tenant-rls.ts`
- **final-contracts.service.ts** (26 connections) — `backend/src/modules/final-contracts/final-contracts.service.ts`
- **cycle-count-execution.service.ts** (25 connections) — `backend/src/modules/cycle-count/cycle-count-execution.service.ts`
- **locations.service.ts** (25 connections) — `backend/src/modules/locations/locations.service.ts`
- *... and 232 more nodes in this community*

## Relationships

- [@nestjs/common](@nestjs-common.md) (175 shared connections)
- [outbound.service.ts](outbound.service.ts.md) (96 shared connections)
- [AuditLogService](AuditLogService.md) (92 shared connections)
- [AuthPrincipal](AuthPrincipal.md) (72 shared connections)
- [BillingInvoiceCalculationService](BillingInvoiceCalculationService.md) (70 shared connections)
- [app.module.ts](app.module.ts.md) (61 shared connections)
- [cycle-count.service.ts](cycle-count.service.ts.md) (49 shared connections)
- [RealtimeService](RealtimeService.md) (49 shared connections)
- [RunReportQueryDto](RunReportQueryDto.md) (48 shared connections)
- [NotificationsService](NotificationsService.md) (43 shared connections)
- [inventory.service.ts](inventory.service.ts.md) (42 shared connections)
- [withTenantRls](withTenantRls.md) (41 shared connections)

## Source Files

- `backend/package.json`
- `backend/scripts/reconcile-oms-ready-to-ship.ts`
- `backend/scripts/verify-inbound-traceability-staging.ts`
- `backend/src/common/auth/company-read-scope.ts`
- `backend/src/common/auth/current-user.types.ts`
- `backend/src/common/company-access/company-access.service.ts`
- `backend/src/common/company-access/company-access.types.ts`
- `backend/src/common/company-access/index.ts`
- `backend/src/common/cron/cron-leader.service.ts`
- `backend/src/common/crypto/password.service.ts`
- `backend/src/common/prisma/prisma.service.ts`
- `backend/src/common/prisma/tenant-rls.ts`
- `backend/src/modules/auth/auth.service.ts`
- `backend/src/modules/auth/refresh-session.service.ts`
- `backend/src/modules/auth/strategies/jwt.strategy.ts`
- `backend/src/modules/auth/user-activity.service.ts`
- `backend/src/modules/billing/billing-audit.service.ts`
- `backend/src/modules/billing/billing-cycle-processor.service.ts`
- `backend/src/modules/billing/billing-cycles.service.ts`
- `backend/src/modules/billing/billing-dashboard.service.ts`

## Audit Trail

- EXTRACTED: 2301 (99%)
- INFERRED: 17 (1%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*