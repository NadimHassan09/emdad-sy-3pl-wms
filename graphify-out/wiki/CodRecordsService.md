# CodRecordsService

> 35 nodes · cohesion 0.08

## Key Concepts

- **CodRecordsService** (30 connections) — `backend/src/modules/cod/cod-records.service.ts`
- **ExpectedReturnHoldService** (18 connections) — `backend/src/modules/inventory/expected-return-hold.service.ts`
- **expected-return-hold.service.ts** (12 connections) — `backend/src/modules/inventory/expected-return-hold.service.ts`
- **.constructor()** (10 connections) — `backend/src/modules/oms-returns/oms-returns.service.ts`
- **.list()** (7 connections) — `backend/src/modules/cod/cod-records.service.ts`
- **.resolveListWhere()** (7 connections) — `backend/src/modules/cod/cod-records.service.ts`
- **.constructor()** (7 connections) — `backend/src/modules/inventory/inventory.service.ts`
- **.constructor()** (7 connections) — `backend/src/modules/shipping/shipping-auto-return.service.ts`
- **cod-records.service.unit.spec.ts** (6 connections) — `backend/src/modules/cod/cod-records.service.unit.spec.ts`
- **.describeHold()** (6 connections) — `backend/src/modules/inventory/expected-return-hold.service.ts`
- **cod-list-filter.util.ts** (5 connections) — `backend/src/modules/cod/cod-list-filter.util.ts`
- **.constructor()** (5 connections) — `backend/src/modules/cod/cod-records.service.ts`
- **expected-return-hold.service.unit.spec.ts** (5 connections) — `backend/src/modules/inventory/expected-return-hold.service.unit.spec.ts`
- **buildCodRecordWhere()** (4 connections) — `backend/src/modules/cod/cod-list-filter.util.ts`
- **.activateHold()** (4 connections) — `backend/src/modules/inventory/expected-return-hold.service.ts`
- **.assertConvertible()** (4 connections) — `backend/src/modules/inventory/expected-return-hold.service.ts`
- **.assertReleasable()** (4 connections) — `backend/src/modules/inventory/expected-return-hold.service.ts`
- **.expectedQuantityForProduct()** (4 connections) — `backend/src/modules/inventory/expected-return-hold.service.ts`
- **.holdStateFromStatus()** (3 connections) — `backend/src/modules/inventory/expected-return-hold.service.ts`
- **.sumExpectedByProduct()** (3 connections) — `backend/src/modules/inventory/expected-return-hold.service.ts`
- **build()** (3 connections) — `backend/src/modules/inventory/expected-return-hold.service.unit.spec.ts`
- **cod-list-filter.util.unit.spec.ts** (2 connections) — `backend/src/modules/cod/cod-list-filter.util.unit.spec.ts`
- **.constructor()** (2 connections) — `backend/src/modules/inventory/expected-return-hold.service.ts`
- **.isActiveStatus()** (2 connections) — `backend/src/modules/inventory/expected-return-hold.service.ts`
- **dec()** (2 connections) — `backend/src/modules/inventory/expected-return-hold.service.unit.spec.ts`
- *... and 10 more nodes in this community*

## Relationships

- [@prisma/client](@prisma-client.md) (28 shared connections)
- [CodController](CodController.md) (14 shared connections)
- [task-inventory-effects.service.ts](task-inventory-effects.service.ts.md) (4 shared connections)
- [cod-export.util.ts](cod-export.util.ts.md) (4 shared connections)
- [RealtimeService](RealtimeService.md) (4 shared connections)
- [EncryptionService](EncryptionService.md) (4 shared connections)
- [@nestjs/common](@nestjs-common.md) (3 shared connections)
- [app.module.ts](app.module.ts.md) (3 shared connections)
- [inventory.service.ts](inventory.service.ts.md) (3 shared connections)
- [.validateResourceOwnership](validateResourceOwnership.md) (2 shared connections)
- [AuthPrincipal](AuthPrincipal.md) (2 shared connections)
- [ListCodRecordsQueryDto](ListCodRecordsQueryDto.md) (2 shared connections)

## Source Files

- `backend/src/modules/cod/cod-list-filter.util.ts`
- `backend/src/modules/cod/cod-list-filter.util.unit.spec.ts`
- `backend/src/modules/cod/cod-records.service.ts`
- `backend/src/modules/cod/cod-records.service.unit.spec.ts`
- `backend/src/modules/inventory/expected-return-hold.service.ts`
- `backend/src/modules/inventory/expected-return-hold.service.unit.spec.ts`
- `backend/src/modules/inventory/inventory.service.ts`
- `backend/src/modules/oms-returns/oms-returns.service.ts`
- `backend/src/modules/shipping/shipping-auto-return.service.ts`

## Audit Trail

- EXTRACTED: 121 (95%)
- INFERRED: 6 (5%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*