# class-validator

> 120 nodes · cohesion 0.04

## Key Concepts

- **class-validator** (152 connections) — `backend/package.json`
- **IsUuidLoose()** (140 connections) — `backend/src/common/validators/is-uuid-loose.ts`
- **class-transformer** (66 connections) — `backend/package.json`
- **is-uuid-loose.ts** (64 connections) — `backend/src/common/validators/is-uuid-loose.ts`
- **inventory.controller.ts** (32 connections) — `backend/src/modules/inventory/inventory.controller.ts`
- **cycle-count.controller.ts** (31 connections) — `backend/src/modules/cycle-count/cycle-count.controller.ts`
- **list-inbound-query.dto.ts** (15 connections) — `backend/src/modules/inbound/dto/list-inbound-query.dto.ts`
- **bulk-outbound.dto.ts** (14 connections) — `backend/src/modules/outbound/dto/bulk-outbound.dto.ts`
- **create-outbound.dto.ts** (13 connections) — `backend/src/modules/outbound/dto/create-outbound.dto.ts`
- **create-return-order.dto.ts** (13 connections) — `backend/src/modules/returns/dto/create-return-order.dto.ts`
- **create-inbound.dto.ts** (12 connections) — `backend/src/modules/inbound/dto/create-inbound.dto.ts`
- **update-shipping-details.dto.ts** (11 connections) — `backend/src/modules/outbound/dto/update-shipping-details.dto.ts`
- **invoice-mutations.dto.ts** (10 connections) — `backend/src/modules/billing/dto/invoice-mutations.dto.ts`
- **CreateCycleCountDto** (10 connections) — `backend/src/modules/cycle-count/dto/create-cycle-count.dto.ts`
- **UpsertCycleCountScheduleDto** (10 connections) — `backend/src/modules/cycle-count/dto/upsert-cycle-count-schedule.dto.ts`
- **InternalTransferDto** (10 connections) — `backend/src/modules/inventory/dto/internal-transfer.dto.ts`
- **AddAdjustmentLineDto** (9 connections) — `backend/src/modules/adjustments/dto/add-adjustment-line.dto.ts`
- **create-adjustment.dto.ts** (9 connections) — `backend/src/modules/adjustments/dto/create-adjustment.dto.ts`
- **bulk-confirm-client-oms-orders.dto.ts** (9 connections) — `backend/src/modules/client-portal/oms/dto/bulk-confirm-client-oms-orders.dto.ts`
- **LedgerEntryQueryDto** (9 connections) — `backend/src/modules/inventory/dto/ledger-entry-query.dto.ts`
- **update-location.dto.ts** (9 connections) — `backend/src/modules/locations/dto/update-location.dto.ts`
- **adjust-shipping-fee.dto.ts** (9 connections) — `backend/src/modules/oms/dto/adjust-shipping-fee.dto.ts`
- **create-order-manual-charge.dto.ts** (8 connections) — `backend/src/modules/billing/dto/create-order-manual-charge.dto.ts`
- **update-billing-plan.dto.ts** (8 connections) — `backend/src/modules/billing/dto/update-billing-plan.dto.ts`
- **upsert-cycle-count-schedule.dto.ts** (8 connections) — `backend/src/modules/cycle-count/dto/upsert-cycle-count-schedule.dto.ts`
- *... and 95 more nodes in this community*

## Relationships

- [EmptyToUndefined](EmptyToUndefined.md) (95 shared connections)
- [@nestjs/common](@nestjs-common.md) (57 shared connections)
- [@prisma/client](@prisma-client.md) (41 shared connections)
- [CreateOmsOrderDto](CreateOmsOrderDto.md) (28 shared connections)
- [cycle-count.service.ts](cycle-count.service.ts.md) (21 shared connections)
- [LocationsService](LocationsService.md) (17 shared connections)
- [inbound-orders-csv.service.ts](inbound-orders-csv.service.ts.md) (17 shared connections)
- [warehouse-tasks.controller.ts](warehouse-tasks.controller.ts.md) (16 shared connections)
- [shipping.controller.ts](shipping.controller.ts.md) (16 shared connections)
- [returns.controller.ts](returns.controller.ts.md) (14 shared connections)
- [CurrentUser](CurrentUser.md) (11 shared connections)
- [CycleCountService](CycleCountService.md) (11 shared connections)

## Source Files

- `backend/package.json`
- `backend/src/common/validators/is-uuid-loose.ts`
- `backend/src/modules/adjustments/dto/add-adjustment-line.dto.ts`
- `backend/src/modules/adjustments/dto/create-adjustment.dto.ts`
- `backend/src/modules/billing/dto/create-billing-plan.dto.ts`
- `backend/src/modules/billing/dto/create-order-manual-charge.dto.ts`
- `backend/src/modules/billing/dto/invoice-mutations.dto.ts`
- `backend/src/modules/billing/dto/update-billing-plan.dto.ts`
- `backend/src/modules/billing/dto/update-order-manual-charge.dto.ts`
- `backend/src/modules/client-portal/api-credentials/dto/create-api-credential.dto.ts`
- `backend/src/modules/client-portal/external-api/dto/external-create-inbound-order.dto.ts`
- `backend/src/modules/client-portal/external-api/dto/external-create-inbound-outbound.dto.unit.spec.ts`
- `backend/src/modules/client-portal/external-api/dto/external-create-oms-order.dto.unit.spec.ts`
- `backend/src/modules/client-portal/external-api/dto/external-create-outbound-order.dto.ts`
- `backend/src/modules/client-portal/inbound/dto/client-inbound-export.dto.ts`
- `backend/src/modules/client-portal/oms/dto/bulk-confirm-client-oms-orders.dto.ts`
- `backend/src/modules/client-portal/oms/dto/create-client-oms-order.dto.unit.spec.ts`
- `backend/src/modules/client-portal/outbound/dto/client-outbound-export.dto.ts`
- `backend/src/modules/client-portal/products/dto/client-create-product.dto.ts`
- `backend/src/modules/client-portal/products/dto/client-update-product.dto.ts`

## Audit Trail

- EXTRACTED: 810 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*