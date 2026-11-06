# task-inventory-effects.service.ts

> 99 nodes · cohesion 0.04

## Key Concepts

- **task-inventory-effects.service.ts** (39 connections) — `backend/src/modules/warehouse-workflow/task-inventory-effects.service.ts`
- **StockHelpers** (33 connections) — `backend/src/modules/inventory/stock.helpers.ts`
- **assertDiscreteUomPositiveIntegerQuantity()** (31 connections) — `backend/src/common/utils/discrete-uom-quantity.ts`
- **TaskInventoryEffectsService** (29 connections) — `backend/src/modules/warehouse-workflow/task-inventory-effects.service.ts`
- **order-allocation.service.ts** (24 connections) — `backend/src/modules/oms/order-allocation.service.ts`
- **TaskCompleteBody** (22 connections) — `backend/src/vendor/wms-task-execution/complete.ts`
- **discrete-uom-quantity.ts** (21 connections) — `backend/src/common/utils/discrete-uom-quantity.ts`
- **stock.helpers.ts** (21 connections) — `backend/src/modules/inventory/stock.helpers.ts`
- **OrderAllocationService** (20 connections) — `backend/src/modules/oms/order-allocation.service.ts`
- **.constructor()** (20 connections) — `backend/src/modules/outbound/outbound.service.ts`
- **.constructor()** (19 connections) — `backend/src/modules/oms/oms-orders.service.ts`
- **BillingAccessService** (17 connections) — `backend/src/modules/billing/billing-access.service.ts`
- **OmsOrderEventsService** (17 connections) — `backend/src/modules/oms/oms-order-events.service.ts`
- **InsufficientStockException** (16 connections) — `backend/src/common/errors/domain-exceptions.ts`
- **.approve()** (14 connections) — `backend/src/modules/adjustments/adjustments.service.ts`
- **OmsOutboundSyncService** (13 connections) — `backend/src/modules/oms/oms-outbound-sync.service.ts`
- **.decrementWithMeta()** (11 connections) — `backend/src/modules/inventory/stock.helpers.ts`
- **order-allocation.service.unit.spec.ts** (11 connections) — `backend/src/modules/oms/order-allocation.service.unit.spec.ts`
- **.applyDispatchShip()** (11 connections) — `backend/src/modules/warehouse-workflow/task-inventory-effects.service.ts`
- **.applyPutaway()** (11 connections) — `backend/src/modules/warehouse-workflow/task-inventory-effects.service.ts`
- **.applyReceivingStaging()** (11 connections) — `backend/src/modules/warehouse-workflow/task-inventory-effects.service.ts`
- **assertDiscreteUomPositiveIntegerDecimal()** (10 connections) — `backend/src/common/utils/discrete-uom-quantity.ts`
- **.constructor()** (10 connections) — `backend/src/modules/inbound/inbound.service.ts`
- **.appendIfAbsent()** (9 connections) — `backend/src/modules/inventory/ledger-idempotency.service.ts`
- **.upsertPositiveWithMeta()** (9 connections) — `backend/src/modules/inventory/stock.helpers.ts`
- *... and 74 more nodes in this community*

## Relationships

- [outbound.service.ts](outbound.service.ts.md) (53 shared connections)
- [@prisma/client](@prisma-client.md) (35 shared connections)
- [withTenantRls](withTenantRls.md) (32 shared connections)
- [returns.service.ts](returns.service.ts.md) (17 shared connections)
- [WarehouseTasksService](WarehouseTasksService.md) (17 shared connections)
- [warehouse-tasks.service.ts](warehouse-tasks.service.ts.md) (17 shared connections)
- [reliability-test-helpers.ts](reliability-test-helpers.ts.md) (13 shared connections)
- [app.module.ts](app.module.ts.md) (12 shared connections)
- [cycle-count.service.ts](cycle-count.service.ts.md) (11 shared connections)
- [oms-client-import.service.ts](oms-client-import.service.ts.md) (11 shared connections)
- [RealtimeService](RealtimeService.md) (7 shared connections)
- [inventory.service.ts](inventory.service.ts.md) (5 shared connections)

## Source Files

- `backend/src/common/errors/domain-exceptions.ts`
- `backend/src/common/utils/discrete-uom-quantity.ts`
- `backend/src/common/utils/discrete-uom-quantity.unit.spec.ts`
- `backend/src/modules/adjustments/adjustments.service.ts`
- `backend/src/modules/billing/billing-access.service.ts`
- `backend/src/modules/inbound/inbound.service.ts`
- `backend/src/modules/inventory/inventory-consistency.service.ts`
- `backend/src/modules/inventory/ledger-idempotency.service.ts`
- `backend/src/modules/inventory/stock.helpers.ts`
- `backend/src/modules/oms/oms-order-events.service.ts`
- `backend/src/modules/oms/oms-orders.service.ts`
- `backend/src/modules/oms/oms-outbound-sync.service.ts`
- `backend/src/modules/oms/order-allocation.service.ts`
- `backend/src/modules/oms/order-allocation.service.unit.spec.ts`
- `backend/src/modules/outbound/outbound.service.ts`
- `backend/src/modules/products/products.service.ts`
- `backend/src/modules/shipping/shipping-auto-return.service.ts`
- `backend/src/modules/warehouse-workflow/feature-flags.ts`
- `backend/src/modules/warehouse-workflow/pick-concurrency.util.ts`
- `backend/src/modules/warehouse-workflow/task-allocation.helper.ts`

## Audit Trail

- EXTRACTED: 435 (89%)
- INFERRED: 55 (11%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*