# CodController

> 34 nodes · cohesion 0.11

## Key Concepts

- **CodController** (13 connections) — `backend/src/modules/cod/cod.controller.ts`
- **.exportRecords()** (10 connections) — `backend/src/modules/cod/cod.controller.ts`
- **.exportRecordsPdf()** (10 connections) — `backend/src/modules/cod/cod.controller.ts`
- **.generateForDeliveredOrder()** (10 connections) — `backend/src/modules/cod/cod-records.service.ts`
- **serialize()** (10 connections) — `backend/src/modules/cod/cod-records.service.ts`
- **.addManualAdjustment()** (9 connections) — `backend/src/modules/cod/cod-records.service.ts`
- **.setStatus()** (9 connections) — `backend/src/modules/cod/cod-records.service.ts`
- **.adjust()** (8 connections) — `backend/src/modules/cod/cod.controller.ts`
- **.setStatus()** (8 connections) — `backend/src/modules/cod/cod.controller.ts`
- **.createReturnAdjustment()** (8 connections) — `backend/src/modules/cod/cod-records.service.ts`
- **.syncReturnedStatusIfNeeded()** (8 connections) — `backend/src/modules/cod/cod-records.service.ts`
- **.voidForDeliveryRevert()** (8 connections) — `backend/src/modules/cod/cod-records.service.ts`
- **.emitCodUpdated()** (8 connections) — `backend/src/modules/realtime/realtime.service.ts`
- **.list()** (7 connections) — `backend/src/modules/cod/cod.controller.ts`
- **.setStatusByScan()** (7 connections) — `backend/src/modules/cod/cod.controller.ts`
- **.recordEvent()** (7 connections) — `backend/src/modules/cod/cod-records.service.ts`
- **.byOrder()** (6 connections) — `backend/src/modules/cod/cod.controller.ts`
- **.findOne()** (6 connections) — `backend/src/modules/cod/cod.controller.ts`
- **.retry()** (6 connections) — `backend/src/modules/cod/cod.controller.ts`
- **.findById()** (6 connections) — `backend/src/modules/cod/cod-records.service.ts`
- **.findByOmsOrder()** (6 connections) — `backend/src/modules/cod/cod-records.service.ts`
- **Get** (5 connections)
- **Param** (5 connections)
- **.setStatusByScan()** (5 connections) — `backend/src/modules/cod/cod-records.service.ts`
- **codExportContentDisposition()** (4 connections) — `backend/src/modules/cod/cod-export.util.ts`
- *... and 9 more nodes in this community*

## Relationships

- [AuthPrincipal](AuthPrincipal.md) (19 shared connections)
- [CodRecordsService](CodRecordsService.md) (14 shared connections)
- [withTenantRls](withTenantRls.md) (10 shared connections)
- [CurrentUser](CurrentUser.md) (9 shared connections)
- [.validateResourceOwnership](validateResourceOwnership.md) (9 shared connections)
- [ListCodRecordsQueryDto](ListCodRecordsQueryDto.md) (7 shared connections)
- [cod-export.util.ts](cod-export.util.ts.md) (4 shared connections)
- [RealtimeService](RealtimeService.md) (4 shared connections)
- [outbound.service.ts](outbound.service.ts.md) (3 shared connections)
- [@nestjs/common](@nestjs-common.md) (2 shared connections)
- [app.module.ts](app.module.ts.md) (1 shared connections)
- [EncryptionService](EncryptionService.md) (1 shared connections)

## Source Files

- `backend/src/modules/cod/cod-export.util.ts`
- `backend/src/modules/cod/cod-records.service.ts`
- `backend/src/modules/cod/cod.controller.ts`
- `backend/src/modules/realtime/realtime.service.ts`

## Audit Trail

- EXTRACTED: 122 (83%)
- INFERRED: 25 (17%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*