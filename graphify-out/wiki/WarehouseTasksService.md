# WarehouseTasksService

> 97 nodes · cohesion 0.08

## Key Concepts

- **WarehouseTasksService** (68 connections) — `backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts`
- **.complete()** (43 connections) — `backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts`
- **.start()** (25 connections) — `backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts`
- **Roles()** (23 connections) — `backend/src/common/auth/roles.decorator.ts`
- **WarehouseTasksController** (22 connections) — `backend/src/modules/warehouse-workflow/warehouse-tasks.controller.ts`
- **.adminQuietStartAndCompletePick()** (19 connections) — `backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts`
- **.loadTaskEnvelope()** (19 connections) — `backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts`
- **.logTx()** (18 connections) — `backend/src/common/audit/audit-log.service.ts`
- **Param** (17 connections)
- **.appendEvent()** (16 connections) — `backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts`
- **.assertTaskWorkflowTenant()** (16 connections) — `backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts`
- **.cancel()** (16 connections) — `backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts`
- **.fail()** (16 connections) — `backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts`
- **.lockTask()** (16 connections) — `backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts`
- **.resolveBlocked()** (16 connections) — `backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts`
- **.emitTaskUpdatedByTaskId()** (15 connections) — `backend/src/modules/realtime/realtime.service.ts`
- **.afterTaskMutation()** (14 connections) — `backend/src/common/redis/cache-invalidation.service.ts`
- **UseGuards** (14 connections)
- **Post** (13 connections)
- **.reopen()** (13 connections) — `backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts`
- **.skipTask()** (13 connections) — `backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts`
- **Body** (12 connections)
- **.patchPlan()** (12 connections) — `backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts`
- **.assign()** (11 connections) — `backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts`
- **.bumpStatus()** (11 connections) — `backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts`
- *... and 72 more nodes in this community*

## Relationships

- [AuthPrincipal](AuthPrincipal.md) (46 shared connections)
- [warehouse-tasks.service.ts](warehouse-tasks.service.ts.md) (21 shared connections)
- [CurrentUser](CurrentUser.md) (19 shared connections)
- [task-inventory-effects.service.ts](task-inventory-effects.service.ts.md) (17 shared connections)
- [.fromPrincipal](fromPrincipal.md) (16 shared connections)
- [warehouse-tasks.controller.ts](warehouse-tasks.controller.ts.md) (15 shared connections)
- [CacheInvalidationService](CacheInvalidationService.md) (4 shared connections)
- [RealtimeService](RealtimeService.md) (4 shared connections)
- [CycleCountService](CycleCountService.md) (3 shared connections)
- [AuditLogService](AuditLogService.md) (2 shared connections)
- [inventory.service.ts](inventory.service.ts.md) (2 shared connections)
- [returns.service.ts](returns.service.ts.md) (2 shared connections)

## Source Files

- `backend/src/common/audit/audit-log.service.ts`
- `backend/src/common/auth/roles.decorator.ts`
- `backend/src/common/redis/cache-invalidation.service.ts`
- `backend/src/modules/outbound/outbound.service.ts`
- `backend/src/modules/realtime/realtime.service.ts`
- `backend/src/modules/warehouse-workflow/dto/list-tasks-query.dto.ts`
- `backend/src/modules/warehouse-workflow/task-transitions.ts`
- `backend/src/modules/warehouse-workflow/warehouse-tasks.controller.ts`
- `backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts`

## Audit Trail

- EXTRACTED: 442 (82%)
- INFERRED: 98 (18%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*