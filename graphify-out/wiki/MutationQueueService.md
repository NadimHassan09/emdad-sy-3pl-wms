# MutationQueueService

> 18 nodes · cohesion 0.18

## Key Concepts

- **MutationQueueService** (20 connections) — `backend/src/modules/realtime/sync/mutation-queue.service.ts`
- **AppModuleId** (10 connections) — `backend/src/modules/realtime/sync/app-modules.ts`
- **.processBatch()** (10 connections) — `backend/src/modules/realtime/sync/mutation-queue.service.ts`
- **.drain()** (6 connections) — `backend/src/modules/realtime/sync/mutation-queue.service.ts`
- **.attachMutationQueue()** (4 connections) — `backend/src/modules/realtime/realtime.service.ts`
- **.publish()** (4 connections) — `backend/src/modules/realtime/sync/mutation-bus.service.ts`
- **.emitToCompany()** (4 connections) — `backend/src/modules/realtime/sync/mutation-queue.service.ts`
- **.emitToUser()** (4 connections) — `backend/src/modules/realtime/sync/mutation-queue.service.ts`
- **.constructor()** (3 connections) — `backend/src/modules/realtime/realtime.module.ts`
- **.attachServer()** (3 connections) — `backend/src/modules/realtime/sync/mutation-queue.service.ts`
- **.emitToAdmin()** (3 connections) — `backend/src/modules/realtime/sync/mutation-queue.service.ts`
- **.enqueue()** (3 connections) — `backend/src/modules/realtime/sync/mutation-queue.service.ts`
- **.scheduleEmit()** (3 connections) — `backend/src/modules/realtime/sync/mutation-queue.service.ts`
- **.takeMergeBatch()** (3 connections) — `backend/src/modules/realtime/sync/mutation-queue.service.ts`
- **.onModuleInit()** (2 connections) — `backend/src/modules/realtime/realtime.module.ts`
- **.emitSystemVersion()** (2 connections) — `backend/src/modules/realtime/sync/realtime-sync-mode.service.ts`
- **.onModuleDestroy()** (1 connections) — `backend/src/modules/realtime/sync/mutation-queue.service.ts`
- **Injectable** (1 connections)

## Relationships

- [RealtimeService](RealtimeService.md) (10 shared connections)
- [app.module.ts](app.module.ts.md) (7 shared connections)
- [mutation-queue.service.ts](mutation-queue.service.ts.md) (7 shared connections)
- [RedisService](RedisService.md) (4 shared connections)

## Source Files

- `backend/src/modules/realtime/realtime.module.ts`
- `backend/src/modules/realtime/realtime.service.ts`
- `backend/src/modules/realtime/sync/app-modules.ts`
- `backend/src/modules/realtime/sync/mutation-bus.service.ts`
- `backend/src/modules/realtime/sync/mutation-queue.service.ts`
- `backend/src/modules/realtime/sync/realtime-sync-mode.service.ts`

## Audit Trail

- EXTRACTED: 49 (86%)
- INFERRED: 8 (14%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*