# .validateResourceOwnership

> 111 nodes · cohesion 0.05

## Key Concepts

- **.validateResourceOwnership()** (77 connections) — `backend/src/common/company-access/company-access.service.ts`
- **OmsReturnsService** (43 connections) — `backend/src/modules/oms-returns/oms-returns.service.ts`
- **OmsReturnsController** (21 connections) — `backend/src/modules/oms-returns/oms-returns.controller.ts`
- **.approve()** (20 connections) — `backend/src/modules/oms-returns/oms-returns.service.ts`
- **oms-returns.controller.ts** (19 connections) — `backend/src/modules/oms-returns/oms-returns.controller.ts`
- **CreateOmsReturnDto** (17 connections) — `backend/src/modules/oms-returns/dto/oms-return.dto.ts`
- **oms-return.dto.ts** (16 connections) — `backend/src/modules/oms-returns/dto/oms-return.dto.ts`
- **.create()** (16 connections) — `backend/src/modules/oms-returns/oms-returns.service.ts`
- **ImportOmsReturnsDto** (15 connections) — `backend/src/modules/oms-returns/dto/oms-return.dto.ts`
- **Post** (14 connections)
- **.completePutawayAdmin()** (14 connections) — `backend/src/modules/oms-returns/oms-returns.service.ts`
- **.updatePlan()** (14 connections) — `backend/src/modules/oms-returns/oms-returns.service.ts`
- **express-return-resolve.ts** (13 connections) — `backend/src/modules/oms-returns/express-return-resolve.ts`
- **.findById()** (13 connections) — `backend/src/modules/oms-returns/oms-returns.service.ts`
- **.rollbackReturn()** (13 connections) — `backend/src/modules/oms-returns/oms-returns.service.ts`
- **.complete()** (13 connections) — `backend/src/modules/returns/returns.service.ts`
- **.findById()** (13 connections) — `backend/src/modules/returns/returns.service.ts`
- **Body** (12 connections)
- **.prepareNormalReturnImport()** (12 connections) — `backend/src/modules/oms-returns/oms-returns.service.ts`
- **.autoCompleteReturn()** (11 connections) — `backend/src/modules/oms-returns/oms-returns.service.ts`
- **.completeReceivingAdmin()** (11 connections) — `backend/src/modules/oms-returns/oms-returns.service.ts`
- **.confirmReturnByScan()** (11 connections) — `backend/src/modules/oms-returns/oms-returns.service.ts`
- **isOmsReturnEligibleStatus()** (10 connections) — `backend/src/modules/oms/oms-return-eligibility.ts`
- **UpdateOmsReturnPlanDto** (10 connections) — `backend/src/modules/oms-returns/dto/oms-return.dto.ts`
- **.emitReturn()** (10 connections) — `backend/src/modules/oms-returns/oms-returns.service.ts`
- *... and 86 more nodes in this community*

## Relationships

- [AuthPrincipal](AuthPrincipal.md) (47 shared connections)
- [@prisma/client](@prisma-client.md) (33 shared connections)
- [.fromPrincipal](fromPrincipal.md) (23 shared connections)
- [CurrentUser](CurrentUser.md) (18 shared connections)
- [withTenantRls](withTenantRls.md) (15 shared connections)
- [outbound.service.ts](outbound.service.ts.md) (14 shared connections)
- [CycleCountService](CycleCountService.md) (13 shared connections)
- [ReturnsService](ReturnsService.md) (12 shared connections)
- [CodController](CodController.md) (9 shared connections)
- [@nestjs/common](@nestjs-common.md) (9 shared connections)
- [ClientPrincipal](ClientPrincipal.md) (7 shared connections)
- [class-validator](class-validator.md) (7 shared connections)

## Source Files

- `backend/src/common/company-access/company-access.service.ts`
- `backend/src/modules/client-portal/oms-returns/client-oms-returns.service.ts`
- `backend/src/modules/cod/cod-records.service.ts`
- `backend/src/modules/oms-returns/dto/oms-return.dto.ts`
- `backend/src/modules/oms-returns/express-return-resolve.ts`
- `backend/src/modules/oms-returns/express-return-resolve.unit.spec.ts`
- `backend/src/modules/oms-returns/normal-return-import-validate.unit.spec.ts`
- `backend/src/modules/oms-returns/normal-return-import.ts`
- `backend/src/modules/oms-returns/normal-return-import.unit.spec.ts`
- `backend/src/modules/oms-returns/oms-return-admin-stages.ts`
- `backend/src/modules/oms-returns/oms-returns.controller.ts`
- `backend/src/modules/oms-returns/oms-returns.service.ts`
- `backend/src/modules/oms/oms-return-eligibility.ts`
- `backend/src/modules/returns/returns.service.ts`

## Audit Trail

- EXTRACTED: 433 (78%)
- INFERRED: 121 (22%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*