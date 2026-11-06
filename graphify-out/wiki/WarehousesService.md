# WarehousesService

> 44 nodes · cohesion 0.08

## Key Concepts

- **WarehousesService** (15 connections) — `backend/src/modules/warehouses/warehouses.service.ts`
- **WarehousesController** (11 connections) — `backend/src/modules/warehouses/warehouses.controller.ts`
- **.create()** (10 connections) — `backend/src/modules/warehouses/warehouses.service.ts`
- **.update()** (10 connections) — `backend/src/modules/warehouses/warehouses.service.ts`
- **.setStatus()** (9 connections) — `backend/src/modules/warehouses/warehouses.controller.ts`
- **.update()** (9 connections) — `backend/src/modules/warehouses/warehouses.controller.ts`
- **.setStatus()** (9 connections) — `backend/src/modules/warehouses/warehouses.service.ts`
- **.softDelete()** (9 connections) — `backend/src/modules/warehouses/warehouses.service.ts`
- **CreateWarehouseDto** (8 connections) — `backend/src/modules/warehouses/dto/create-warehouse.dto.ts`
- **ListWarehousesQueryDto** (8 connections) — `backend/src/modules/warehouses/dto/list-warehouses-query.dto.ts`
- **UpdateWarehouseDto** (8 connections) — `backend/src/modules/warehouses/dto/update-warehouse.dto.ts`
- **.create()** (8 connections) — `backend/src/modules/warehouses/warehouses.controller.ts`
- **.remove()** (7 connections) — `backend/src/modules/warehouses/warehouses.controller.ts`
- **warehouseRealtimePayload()** (6 connections) — `backend/src/modules/realtime/realtime-master-data.payload.ts`
- **.emitWarehouseUpdated()** (6 connections) — `backend/src/modules/realtime/realtime.service.ts`
- **.list()** (5 connections) — `backend/src/modules/warehouses/warehouses.controller.ts`
- **warehouseAuditSnapshot()** (5 connections) — `backend/src/modules/warehouses/warehouses.service.ts`
- **.findById()** (5 connections) — `backend/src/modules/warehouses/warehouses.service.ts`
- **create-warehouse.dto.ts** (4 connections) — `backend/src/modules/warehouses/dto/create-warehouse.dto.ts`
- **update-warehouse.dto.ts** (4 connections) — `backend/src/modules/warehouses/dto/update-warehouse.dto.ts`
- **Param** (4 connections)
- **UseGuards** (4 connections)
- **.findOne()** (4 connections) — `backend/src/modules/warehouses/warehouses.controller.ts`
- **.computeNextCode()** (4 connections) — `backend/src/modules/warehouses/warehouses.service.ts`
- **.list()** (4 connections) — `backend/src/modules/warehouses/warehouses.service.ts`
- *... and 19 more nodes in this community*

## Relationships

- [AuditLogService](AuditLogService.md) (12 shared connections)
- [@nestjs/common](@nestjs-common.md) (8 shared connections)
- [AuthPrincipal](AuthPrincipal.md) (8 shared connections)
- [.fromPrincipal](fromPrincipal.md) (8 shared connections)
- [RealtimeService](RealtimeService.md) (4 shared connections)
- [CurrentUser](CurrentUser.md) (4 shared connections)
- [class-validator](class-validator.md) (2 shared connections)
- [EmptyToUndefined](EmptyToUndefined.md) (2 shared connections)
- [app.module.ts](app.module.ts.md) (2 shared connections)
- [@prisma/client](@prisma-client.md) (1 shared connections)

## Source Files

- `backend/src/modules/realtime/realtime-master-data.payload.ts`
- `backend/src/modules/realtime/realtime.service.ts`
- `backend/src/modules/warehouses/dto/create-warehouse.dto.ts`
- `backend/src/modules/warehouses/dto/list-warehouses-query.dto.ts`
- `backend/src/modules/warehouses/dto/update-warehouse.dto.ts`
- `backend/src/modules/warehouses/warehouses.controller.ts`
- `backend/src/modules/warehouses/warehouses.service.ts`

## Audit Trail

- EXTRACTED: 109 (85%)
- INFERRED: 19 (15%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*