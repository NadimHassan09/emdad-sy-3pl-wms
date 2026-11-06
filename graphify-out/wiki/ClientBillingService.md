# ClientBillingService

> 34 nodes · cohesion 0.09

## Key Concepts

- **ClientBillingService** (15 connections) — `backend/src/modules/client-portal/billing/client-billing.service.ts`
- **.getSummary()** (12 connections) — `backend/src/modules/client-portal/billing/client-billing.service.ts`
- **ClientBillingController** (11 connections) — `backend/src/modules/client-portal/billing/client-billing.controller.ts`
- **ClientDashboardService** (8 connections) — `backend/src/modules/client-portal/dashboard/client-dashboard.service.ts`
- **.exportInvoices()** (7 connections) — `backend/src/modules/client-portal/billing/client-billing.controller.ts`
- **.listInvoices()** (7 connections) — `backend/src/modules/client-portal/billing/client-billing.controller.ts`
- **.assertBillingAccess()** (7 connections) — `backend/src/modules/client-portal/billing/client-billing.service.ts`
- **ClientDashboardController** (7 connections) — `backend/src/modules/client-portal/dashboard/client-dashboard.controller.ts`
- **.getInvoice()** (6 connections) — `backend/src/modules/client-portal/billing/client-billing.controller.ts`
- **.getInvoice()** (6 connections) — `backend/src/modules/client-portal/billing/client-billing.service.ts`
- **.listInvoices()** (6 connections) — `backend/src/modules/client-portal/billing/client-billing.service.ts`
- **.getOverview()** (6 connections) — `backend/src/modules/client-portal/dashboard/client-dashboard.service.ts`
- **.list()** (5 connections) — `backend/src/modules/billing/billing-cycles.service.ts`
- **.list()** (5 connections) — `backend/src/modules/billing/billing-invoices.service.ts`
- **Get** (5 connections)
- **.exportInvoicesXlsx()** (5 connections) — `backend/src/modules/client-portal/billing/client-billing.service.ts`
- **.list()** (4 connections) — `backend/src/modules/billing/billing-plans.service.ts`
- **.listInvoicesPage()** (4 connections) — `backend/src/modules/client-portal/billing/client-billing.service.ts`
- **.constructor()** (4 connections) — `backend/src/modules/client-portal/dashboard/client-dashboard.service.ts`
- **daysRemainingFromEnd()** (3 connections) — `backend/src/modules/client-portal/billing/client-billing.service.ts`
- **deriveAccountStatus()** (3 connections) — `backend/src/modules/client-portal/billing/client-billing.service.ts`
- **.constructor()** (2 connections) — `backend/src/modules/client-portal/billing/client-billing.controller.ts`
- **Query** (2 connections)
- **pickCurrentCycle()** (2 connections) — `backend/src/modules/client-portal/billing/client-billing.service.ts`
- **.constructor()** (2 connections) — `backend/src/modules/client-portal/dashboard/client-dashboard.controller.ts`
- *... and 9 more nodes in this community*

## Relationships

- [ClientPrincipal](ClientPrincipal.md) (24 shared connections)
- [@nestjs/common](@nestjs-common.md) (10 shared connections)
- [@prisma/client](@prisma-client.md) (7 shared connections)
- [BillingInvoiceCalculationService](BillingInvoiceCalculationService.md) (5 shared connections)
- [AuthPrincipal](AuthPrincipal.md) (3 shared connections)
- [BillingController](BillingController.md) (3 shared connections)
- [.assertCompanyAccess](assertCompanyAccess.md) (3 shared connections)
- [inbound-orders-csv.service.ts](inbound-orders-csv.service.ts.md) (1 shared connections)

## Source Files

- `backend/src/modules/billing/billing-cycles.service.ts`
- `backend/src/modules/billing/billing-invoices.service.ts`
- `backend/src/modules/billing/billing-plans.service.ts`
- `backend/src/modules/client-portal/billing/client-billing.controller.ts`
- `backend/src/modules/client-portal/billing/client-billing.service.ts`
- `backend/src/modules/client-portal/dashboard/client-dashboard.controller.ts`
- `backend/src/modules/client-portal/dashboard/client-dashboard.service.ts`

## Audit Trail

- EXTRACTED: 88 (84%)
- INFERRED: 17 (16%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*