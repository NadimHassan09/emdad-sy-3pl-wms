# inventory-consistency.service.ts

> 26 nodes · cohesion 0.17

## Key Concepts

- **inventory-consistency.service.ts** (28 connections) — `backend/src/modules/inventory/inventory-consistency.service.ts`
- **InventoryConsistencyService** (21 connections) — `backend/src/modules/inventory/inventory-consistency.service.ts`
- **.runValidation()** (11 connections) — `backend/src/modules/inventory/inventory-consistency.service.ts`
- **InventoryConsistencyFinding** (8 connections) — `backend/src/modules/inventory/inventory-consistency.types.ts`
- **pushFinding()** (7 connections) — `backend/src/modules/inventory/inventory-consistency.service.ts`
- **.checkTaskReservationDrift()** (6 connections) — `backend/src/modules/inventory/inventory-consistency.service.ts`
- **.validateForUser()** (6 connections) — `backend/src/modules/inventory/inventory-consistency.service.ts`
- **.checkStalePickSnapshots()** (5 connections) — `backend/src/modules/inventory/inventory-consistency.service.ts`
- **inventory-consistency.types.ts** (5 connections) — `backend/src/modules/inventory/inventory-consistency.types.ts`
- **.checkConcurrentActivePicks()** (4 connections) — `backend/src/modules/inventory/inventory-consistency.service.ts`
- **.checkCurrentStockRows()** (4 connections) — `backend/src/modules/inventory/inventory-consistency.service.ts`
- **.checkOutboundLineQuantities()** (4 connections) — `backend/src/modules/inventory/inventory-consistency.service.ts`
- **.checkReservationTableDrift()** (4 connections) — `backend/src/modules/inventory/inventory-consistency.service.ts`
- **reservationRowsFromExec()** (4 connections) — `backend/src/modules/inventory/inventory-consistency.service.ts`
- **InventoryConsistencyReport** (4 connections) — `backend/src/modules/inventory/inventory-consistency.types.ts`
- **.assertScopeHealthy()** (3 connections) — `backend/src/modules/inventory/inventory-consistency.service.ts`
- **.constructor()** (3 connections) — `backend/src/modules/inventory/inventory-consistency.service.ts`
- **countBySeverity()** (2 connections) — `backend/src/modules/inventory/inventory-consistency.service.ts`
- **isRecord()** (2 connections) — `backend/src/modules/inventory/inventory-consistency.service.ts`
- **stockTupleKey()** (2 connections) — `backend/src/modules/inventory/inventory-consistency.service.ts`
- **DRIFT_EPSILON** (1 connections) — `backend/src/modules/inventory/inventory-consistency.service.ts`
- **PickReservationSlice** (1 connections) — `backend/src/modules/inventory/inventory-consistency.service.ts`
- **StockTupleKey** (1 connections) — `backend/src/modules/inventory/inventory-consistency.service.ts`
- **Injectable** (1 connections)
- **InventoryConsistencyCode** (1 connections) — `backend/src/modules/inventory/inventory-consistency.types.ts`
- *... and 1 more nodes in this community*

## Relationships

- [@prisma/client](@prisma-client.md) (11 shared connections)
- [reliability-test-helpers.ts](reliability-test-helpers.ts.md) (4 shared connections)
- [task-inventory-effects.service.ts](task-inventory-effects.service.ts.md) (4 shared connections)
- [outbound.service.ts](outbound.service.ts.md) (3 shared connections)
- [AuthPrincipal](AuthPrincipal.md) (2 shared connections)
- [class-validator](class-validator.md) (2 shared connections)
- [app.module.ts](app.module.ts.md) (2 shared connections)
- [@nestjs/common](@nestjs-common.md) (1 shared connections)
- [inventory.service.ts](inventory.service.ts.md) (1 shared connections)
- [CurrentUser](CurrentUser.md) (1 shared connections)

## Source Files

- `backend/src/modules/inventory/inventory-consistency.service.ts`
- `backend/src/modules/inventory/inventory-consistency.types.ts`

## Audit Trail

- EXTRACTED: 84 (99%)
- INFERRED: 1 (1%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*