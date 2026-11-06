# .fromPrincipal

> 61 nodes · cohesion 0.08

## Key Concepts

- **.fromPrincipal()** (52 connections) — `backend/src/common/audit/audit-log.service.ts`
- **InboundService** (39 connections) — `backend/src/modules/inbound/inbound.service.ts`
- **.log()** (35 connections) — `backend/src/common/audit/audit-log.service.ts`
- **.confirmAndDeduct()** (31 connections) — `backend/src/modules/outbound/outbound.service.ts`
- **.confirm()** (23 connections) — `backend/src/modules/inbound/inbound.service.ts`
- **.create()** (22 connections) — `backend/src/modules/inbound/inbound.service.ts`
- **.completePickingAdmin()** (21 connections) — `backend/src/modules/outbound/outbound.service.ts`
- **normalizeExecutionMode()** (19 connections) — `backend/src/modules/orders/execution-plan.util.ts`
- **.completeDispatchAdmin()** (17 connections) — `backend/src/modules/outbound/outbound.service.ts`
- **parseOutboundExecutionPlan()** (16 connections) — `backend/src/modules/orders/execution-plan.util.ts`
- **.completePackingAdmin()** (16 connections) — `backend/src/modules/outbound/outbound.service.ts`
- **.confirmWithoutDeduction()** (16 connections) — `backend/src/modules/outbound/outbound.service.ts`
- **execution-plan.util.ts** (15 connections) — `backend/src/modules/orders/execution-plan.util.ts`
- **.approveAdmin()** (15 connections) — `backend/src/modules/outbound/outbound.service.ts`
- **.findById()** (14 connections) — `backend/src/modules/inbound/inbound.service.ts`
- **.confirm()** (14 connections) — `backend/src/modules/returns/returns.service.ts`
- **parseInboundExecutionPlan()** (13 connections) — `backend/src/modules/orders/execution-plan.util.ts`
- **outboundRequiresPacking()** (13 connections) — `backend/src/modules/outbound/outbound-admin-stages.ts`
- **.executeAdmin()** (13 connections) — `backend/src/modules/outbound/outbound.service.ts`
- **.receiveLine()** (13 connections) — `backend/src/modules/returns/returns.service.ts`
- **.completePutawayAdmin()** (12 connections) — `backend/src/modules/inbound/inbound.service.ts`
- **.updatePlan()** (12 connections) — `backend/src/modules/inbound/inbound.service.ts`
- **.approveAdmin()** (11 connections) — `backend/src/modules/inbound/inbound.service.ts`
- **.completeReceivingAdmin()** (11 connections) — `backend/src/modules/inbound/inbound.service.ts`
- **.cancel()** (10 connections) — `backend/src/modules/inbound/inbound.service.ts`
- *... and 36 more nodes in this community*

## Relationships

- [outbound.service.ts](outbound.service.ts.md) (68 shared connections)
- [withTenantRls](withTenantRls.md) (63 shared connections)
- [AuthPrincipal](AuthPrincipal.md) (39 shared connections)
- [.validateResourceOwnership](validateResourceOwnership.md) (23 shared connections)
- [WarehouseTasksService](WarehouseTasksService.md) (16 shared connections)
- [ReturnsService](ReturnsService.md) (11 shared connections)
- [@prisma/client](@prisma-client.md) (11 shared connections)
- [inbound-orders-csv.service.ts](inbound-orders-csv.service.ts.md) (10 shared connections)
- [InboundController](InboundController.md) (10 shared connections)
- [RealtimeService](RealtimeService.md) (10 shared connections)
- [WarehousesService](WarehousesService.md) (8 shared connections)
- [.assertCompanyAccess](assertCompanyAccess.md) (7 shared connections)

## Source Files

- `backend/src/common/audit/audit-log.service.ts`
- `backend/src/modules/auth/auth.controller.ts`
- `backend/src/modules/auth/google-oauth.service.ts`
- `backend/src/modules/client-portal/inbound/client-inbound-orders.service.ts`
- `backend/src/modules/client-portal/order-import/inbound-client-import.service.ts`
- `backend/src/modules/cycle-count/cycle-count-variance.service.ts`
- `backend/src/modules/inbound/inbound.service.ts`
- `backend/src/modules/notifications/notifications.service.ts`
- `backend/src/modules/orders/execution-plan.types.ts`
- `backend/src/modules/orders/execution-plan.util.ts`
- `backend/src/modules/outbound/outbound-admin-stages.ts`
- `backend/src/modules/outbound/outbound-admin-task.helpers.ts`
- `backend/src/modules/outbound/outbound.service.ts`
- `backend/src/modules/realtime/realtime-client.payload.ts`
- `backend/src/modules/realtime/realtime.service.ts`
- `backend/src/modules/returns/returns.constants.ts`
- `backend/src/modules/returns/returns.service.ts`
- `backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts`

## Audit Trail

- EXTRACTED: 346 (68%)
- INFERRED: 161 (32%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*