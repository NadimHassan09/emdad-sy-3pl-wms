# BillingController

> 97 nodes · cohesion 0.05

## Key Concepts

- **BillingController** (35 connections) — `backend/src/modules/billing/billing.controller.ts`
- **BillingInvoicesService** (23 connections) — `backend/src/modules/billing/billing-invoices.service.ts`
- **Get** (17 connections)
- **Param** (16 connections)
- **UseGuards** (16 connections)
- **ListBillingInvoicesQueryDto** (15 connections) — `backend/src/modules/billing/dto/list-billing-invoices-query.dto.ts`
- **.findById()** (13 connections) — `backend/src/modules/billing/billing-invoices.service.ts`
- **CreateInvoiceLineDto** (13 connections) — `backend/src/modules/billing/dto/create-invoice-line.dto.ts`
- **BillingDashboardService** (12 connections) — `backend/src/modules/billing/billing-dashboard.service.ts`
- **UpdateOrderManualChargeDto** (11 connections) — `backend/src/modules/billing/dto/update-order-manual-charge.dto.ts`
- **OrderManualChargesService** (11 connections) — `backend/src/modules/billing/order-manual-charges.service.ts`
- **.addInvoiceLine()** (9 connections) — `backend/src/modules/billing/billing.controller.ts`
- **.updateInvoice()** (9 connections) — `backend/src/modules/billing/billing.controller.ts`
- **.updateInvoiceLine()** (9 connections) — `backend/src/modules/billing/billing.controller.ts`
- **.updateInvoiceStatus()** (9 connections) — `backend/src/modules/billing/billing.controller.ts`
- **.updateOrderCharge()** (9 connections) — `backend/src/modules/billing/billing.controller.ts`
- **.updatePlan()** (9 connections) — `backend/src/modules/billing/billing.controller.ts`
- **Body** (9 connections)
- **Query** (9 connections)
- **.applyInvoiceTotals()** (9 connections) — `backend/src/modules/billing/billing-invoice-calculation.service.ts`
- **.createAdHocInvoice()** (8 connections) — `backend/src/modules/billing/billing.controller.ts`
- **.createOrderCharge()** (8 connections) — `backend/src/modules/billing/billing.controller.ts`
- **.createPlan()** (8 connections) — `backend/src/modules/billing/billing.controller.ts`
- **.downloadInvoicePdf()** (8 connections) — `backend/src/modules/billing/billing.controller.ts`
- **.createAdHoc()** (8 connections) — `backend/src/modules/billing/billing-invoices.service.ts`
- *... and 72 more nodes in this community*

## Relationships

- [AuthPrincipal](AuthPrincipal.md) (52 shared connections)
- [CurrentUser](CurrentUser.md) (30 shared connections)
- [BillingInvoiceCalculationService](BillingInvoiceCalculationService.md) (25 shared connections)
- [@prisma/client](@prisma-client.md) (22 shared connections)
- [CreateAdHocInvoiceDto](CreateAdHocInvoiceDto.md) (7 shared connections)
- [.assertCompanyAccess](assertCompanyAccess.md) (7 shared connections)
- [EmptyToUndefined](EmptyToUndefined.md) (4 shared connections)
- [ClientBillingService](ClientBillingService.md) (3 shared connections)
- [CreateOrderManualChargeDto](CreateOrderManualChargeDto.md) (2 shared connections)
- [class-validator](class-validator.md) (2 shared connections)
- [CreateBillingPlanDto](CreateBillingPlanDto.md) (1 shared connections)
- [grn-pdf.service.ts](grn-pdf.service.ts.md) (1 shared connections)

## Source Files

- `backend/src/modules/billing/billing-cycles.service.ts`
- `backend/src/modules/billing/billing-dashboard.service.ts`
- `backend/src/modules/billing/billing-invoice-calculation.service.ts`
- `backend/src/modules/billing/billing-invoices.service.ts`
- `backend/src/modules/billing/billing.controller.ts`
- `backend/src/modules/billing/dto/create-invoice-line.dto.ts`
- `backend/src/modules/billing/dto/list-billing-invoices-query.dto.ts`
- `backend/src/modules/billing/dto/update-order-manual-charge.dto.ts`
- `backend/src/modules/billing/order-manual-charges.service.ts`

## Audit Trail

- EXTRACTED: 322 (87%)
- INFERRED: 50 (13%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*