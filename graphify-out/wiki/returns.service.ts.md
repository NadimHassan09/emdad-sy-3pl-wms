# returns.service.ts

> 61 nodes · cohesion 0.06

## Key Concepts

- **returns.service.ts** (57 connections) — `backend/src/modules/returns/returns.service.ts`
- **return-workflow.service.ts** (31 connections) — `backend/src/modules/returns/return-workflow.service.ts`
- **return-inventory.service.ts** (20 connections) — `backend/src/modules/returns/return-inventory.service.ts`
- **returns.constants.ts** (20 connections) — `backend/src/modules/returns/returns.constants.ts`
- **.applyDisposition()** (15 connections) — `backend/src/modules/returns/return-workflow.service.ts`
- **return-disposition.policy.ts** (14 connections) — `backend/src/modules/returns/return-disposition.policy.ts`
- **assertLocationUsableForInventoryMove()** (13 connections) — `backend/src/common/utils/location-operational.ts`
- **return-line-integrity.util.ts** (12 connections) — `backend/src/modules/returns/return-line-integrity.util.ts`
- **return-quantity.validation.ts** (12 connections) — `backend/src/modules/returns/return-quantity.validation.ts`
- **ReturnWorkflowService** (12 connections) — `backend/src/modules/returns/return-workflow.service.ts`
- **.applyLineInventory()** (11 connections) — `backend/src/modules/returns/return-inventory.service.ts`
- **.inspectLine()** (11 connections) — `backend/src/modules/returns/return-workflow.service.ts`
- **storage-location-types.ts** (10 connections) — `backend/src/common/constants/storage-location-types.ts`
- **.addLine()** (10 connections) — `backend/src/modules/adjustments/adjustments.service.ts`
- **normalizeReturnDisposition()** (9 connections) — `backend/src/modules/returns/return-disposition.policy.ts`
- **ReturnInventoryService** (9 connections) — `backend/src/modules/returns/return-inventory.service.ts`
- **location-operational.ts** (8 connections) — `backend/src/common/utils/location-operational.ts`
- **isAdjustmentStockLocationType()** (7 connections) — `backend/src/common/constants/storage-location-types.ts`
- **assertLocationAllowedForDisposition()** (6 connections) — `backend/src/modules/returns/return-disposition.policy.ts`
- **isInventoryPostingDisposition()** (6 connections) — `backend/src/modules/returns/return-disposition.policy.ts`
- **.constructor()** (6 connections) — `backend/src/modules/returns/return-workflow.service.ts`
- **.loadOrder()** (6 connections) — `backend/src/modules/returns/return-workflow.service.ts`
- **.postAllEligibleLines()** (6 connections) — `backend/src/modules/returns/return-workflow.service.ts`
- **isQuarantineStorageLocationType()** (5 connections) — `backend/src/common/constants/storage-location-types.ts`
- **stockStatusForDisposition()** (4 connections) — `backend/src/modules/returns/return-disposition.policy.ts`
- *... and 36 more nodes in this community*

## Relationships

- [@prisma/client](@prisma-client.md) (30 shared connections)
- [task-inventory-effects.service.ts](task-inventory-effects.service.ts.md) (17 shared connections)
- [outbound.service.ts](outbound.service.ts.md) (16 shared connections)
- [returns.controller.ts](returns.controller.ts.md) (13 shared connections)
- [cycle-count.service.ts](cycle-count.service.ts.md) (11 shared connections)
- [class-validator](class-validator.md) (9 shared connections)
- [@nestjs/common](@nestjs-common.md) (8 shared connections)
- [AuthPrincipal](AuthPrincipal.md) (8 shared connections)
- [inventory.service.ts](inventory.service.ts.md) (7 shared connections)
- [ReturnsService](ReturnsService.md) (7 shared connections)
- [.fromPrincipal](fromPrincipal.md) (7 shared connections)
- [app.module.ts](app.module.ts.md) (6 shared connections)

## Source Files

- `backend/src/common/constants/storage-location-types.ts`
- `backend/src/common/utils/location-operational.ts`
- `backend/src/modules/adjustments/adjustments.service.ts`
- `backend/src/modules/returns/return-disposition.policy.ts`
- `backend/src/modules/returns/return-inventory.service.ts`
- `backend/src/modules/returns/return-line-integrity.util.ts`
- `backend/src/modules/returns/return-quantity.validation.ts`
- `backend/src/modules/returns/return-workflow.service.ts`
- `backend/src/modules/returns/returns.constants.ts`
- `backend/src/modules/returns/returns.service.ts`

## Audit Trail

- EXTRACTED: 256 (93%)
- INFERRED: 18 (7%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*