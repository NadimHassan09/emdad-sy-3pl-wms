# CycleCountService

> 79 nodes · cohesion 0.05

## Key Concepts

- **CycleCountService** (35 connections) — `backend/src/modules/cycle-count/cycle-count.service.ts`
- **CycleCountController** (22 connections) — `backend/src/modules/cycle-count/cycle-count.controller.ts`
- **CycleCountVarianceService** (21 connections) — `backend/src/modules/cycle-count/cycle-count-variance.service.ts`
- **Param** (13 connections)
- **.createManual()** (13 connections) — `backend/src/modules/cycle-count/cycle-count.service.ts`
- **.emitCycleCountEvent()** (13 connections) — `backend/src/modules/cycle-count/cycle-count.service.ts`
- **.complete()** (11 connections) — `backend/src/modules/cycle-count/cycle-count.service.ts`
- **Post** (10 connections)
- **.buildReconciliationDraft()** (10 connections) — `backend/src/modules/cycle-count/cycle-count-variance.service.ts`
- **.assignLine()** (9 connections) — `backend/src/modules/cycle-count/cycle-count.service.ts`
- **.assignSession()** (9 connections) — `backend/src/modules/cycle-count/cycle-count.service.ts`
- **.requireCount()** (9 connections) — `backend/src/modules/cycle-count/cycle-count.service.ts`
- **.skipLine()** (9 connections) — `backend/src/modules/cycle-count/cycle-count.service.ts`
- **.submitForReview()** (9 connections) — `backend/src/modules/cycle-count/cycle-count.service.ts`
- **.review()** (9 connections) — `backend/src/modules/cycle-count/cycle-count-variance.controller.ts`
- **.assignLine()** (8 connections) — `backend/src/modules/cycle-count/cycle-count.controller.ts`
- **.assignSession()** (8 connections) — `backend/src/modules/cycle-count/cycle-count.controller.ts`
- **.skipLine()** (8 connections) — `backend/src/modules/cycle-count/cycle-count.controller.ts`
- **.submitLineCount()** (8 connections) — `backend/src/modules/cycle-count/cycle-count.controller.ts`
- **.upsertSchedule()** (8 connections) — `backend/src/modules/cycle-count/cycle-count.controller.ts`
- **.submitLineCount()** (8 connections) — `backend/src/modules/cycle-count/cycle-count.service.ts`
- **.upsertSchedule()** (8 connections) — `backend/src/modules/cycle-count/cycle-count.service.ts`
- **.buildReconciliation()** (7 connections) — `backend/src/modules/cycle-count/cycle-count.controller.ts`
- **.complete()** (7 connections) — `backend/src/modules/cycle-count/cycle-count.controller.ts`
- **.createCount()** (7 connections) — `backend/src/modules/cycle-count/cycle-count.controller.ts`
- *... and 54 more nodes in this community*

## Relationships

- [AuthPrincipal](AuthPrincipal.md) (40 shared connections)
- [CurrentUser](CurrentUser.md) (21 shared connections)
- [cycle-count.service.ts](cycle-count.service.ts.md) (19 shared connections)
- [.validateResourceOwnership](validateResourceOwnership.md) (13 shared connections)
- [class-validator](class-validator.md) (11 shared connections)
- [outbound.service.ts](outbound.service.ts.md) (11 shared connections)
- [app.module.ts](app.module.ts.md) (8 shared connections)
- [CycleCountExecutionService](CycleCountExecutionService.md) (7 shared connections)
- [EmptyToUndefined](EmptyToUndefined.md) (6 shared connections)
- [@prisma/client](@prisma-client.md) (5 shared connections)
- [.fromPrincipal](fromPrincipal.md) (5 shared connections)
- [withTenantRls](withTenantRls.md) (5 shared connections)

## Source Files

- `backend/src/modules/cycle-count/cycle-count-snapshot.service.ts`
- `backend/src/modules/cycle-count/cycle-count-variance.controller.ts`
- `backend/src/modules/cycle-count/cycle-count-variance.service.ts`
- `backend/src/modules/cycle-count/cycle-count.constants.ts`
- `backend/src/modules/cycle-count/cycle-count.controller.ts`
- `backend/src/modules/cycle-count/cycle-count.service.ts`
- `backend/src/modules/cycle-count/dto/list-cycle-counts-query.dto.ts`
- `backend/src/modules/cycle-count/dto/list-product-history-query.dto.ts`

## Audit Trail

- EXTRACTED: 277 (83%)
- INFERRED: 56 (17%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*