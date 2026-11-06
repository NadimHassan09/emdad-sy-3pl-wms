# BillingInvoiceCalculationService

> 89 nodes · cohesion 0.04

## Key Concepts

- **BillingInvoiceCalculationService** (33 connections) — `backend/src/modules/billing/billing-invoice-calculation.service.ts`
- **billing-invoice-calculation.service.ts** (31 connections) — `backend/src/modules/billing/billing-invoice-calculation.service.ts`
- **BillingUsageService** (20 connections) — `backend/src/modules/billing/billing-usage.service.ts`
- **.recalculateForCompany()** (16 connections) — `backend/src/modules/billing/billing-invoice-calculation.service.ts`
- **BillingPlansService** (16 connections) — `backend/src/modules/billing/billing-plans.service.ts`
- **BillingCyclesService** (15 connections) — `backend/src/modules/billing/billing-cycles.service.ts`
- **BillingVolumeCapacityService** (12 connections) — `backend/src/modules/billing/billing-access.service.ts`
- **.recalculateForCompanyInternal()** (12 connections) — `backend/src/modules/billing/billing-invoice-calculation.service.ts`
- **.renew()** (12 connections) — `backend/src/modules/billing/billing-plans.service.ts`
- **.create()** (11 connections) — `backend/src/modules/billing/billing-plans.service.ts`
- **.update()** (11 connections) — `backend/src/modules/billing/billing-plans.service.ts`
- **billing-rate-snapshot.util.ts** (10 connections) — `backend/src/modules/billing/billing-rate-snapshot.util.ts`
- **billing-plans-list.query.ts** (9 connections) — `backend/src/modules/billing/billing-plans-list.query.ts`
- **.constructor()** (9 connections) — `backend/src/modules/billing/billing-plans.service.ts`
- **.fromUser()** (8 connections) — `backend/src/modules/billing/billing-audit.service.ts`
- **.constructor()** (8 connections) — `backend/src/modules/billing/billing.controller.ts`
- **.listPage()** (8 connections) — `backend/src/modules/billing/billing-plans.service.ts`
- **BillingPreviewService** (7 connections) — `backend/src/modules/billing/billing-preview.service.ts`
- **buildRateSnapshotFromPlan()** (7 connections) — `backend/src/modules/billing/billing-rate-snapshot.util.ts`
- **rateSnapshotToDecimals()** (7 connections) — `backend/src/modules/billing/billing-rate-snapshot.util.ts`
- **billing-recalculation.types.ts** (7 connections) — `backend/src/modules/billing/billing-recalculation.types.ts`
- **.assertWeightAllocation()** (6 connections) — `backend/src/modules/billing/billing-access.service.ts`
- **.renew()** (6 connections) — `backend/src/modules/billing/billing-cycles.service.ts`
- **billing-invoice-calculation.unit.spec.ts** (6 connections) — `backend/src/modules/billing/billing-invoice-calculation.unit.spec.ts`
- **.findById()** (6 connections) — `backend/src/modules/billing/billing-plans.service.ts`
- *... and 64 more nodes in this community*

## Relationships

- [@prisma/client](@prisma-client.md) (70 shared connections)
- [BillingController](BillingController.md) (25 shared connections)
- [AuthPrincipal](AuthPrincipal.md) (10 shared connections)
- [outbound.service.ts](outbound.service.ts.md) (7 shared connections)
- [.assertCompanyAccess](assertCompanyAccess.md) (7 shared connections)
- [NotificationsService](NotificationsService.md) (6 shared connections)
- [RealtimeService](RealtimeService.md) (6 shared connections)
- [ClientBillingService](ClientBillingService.md) (5 shared connections)
- [AuditLogService](AuditLogService.md) (4 shared connections)
- [warehouse-tasks.service.ts](warehouse-tasks.service.ts.md) (4 shared connections)
- [task-inventory-effects.service.ts](task-inventory-effects.service.ts.md) (3 shared connections)
- [EmptyToUndefined](EmptyToUndefined.md) (3 shared connections)

## Source Files

- `backend/src/modules/billing/billing-access.service.ts`
- `backend/src/modules/billing/billing-audit.service.ts`
- `backend/src/modules/billing/billing-cycles.service.ts`
- `backend/src/modules/billing/billing-invoice-calculation.service.ts`
- `backend/src/modules/billing/billing-invoice-calculation.unit.spec.ts`
- `backend/src/modules/billing/billing-plans-list.query.ts`
- `backend/src/modules/billing/billing-plans.service.ts`
- `backend/src/modules/billing/billing-preview.service.ts`
- `backend/src/modules/billing/billing-rate-snapshot.util.ts`
- `backend/src/modules/billing/billing-recalculation-triggers.util.ts`
- `backend/src/modules/billing/billing-recalculation.types.ts`
- `backend/src/modules/billing/billing-totals.util.ts`
- `backend/src/modules/billing/billing-usage-processor.service.ts`
- `backend/src/modules/billing/billing-usage.service.ts`
- `backend/src/modules/billing/billing.controller.ts`
- `backend/src/modules/billing/order-manual-charges.service.ts`
- `backend/src/modules/client-portal/billing/client-billing.service.ts`

## Audit Trail

- EXTRACTED: 263 (82%)
- INFERRED: 56 (18%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*