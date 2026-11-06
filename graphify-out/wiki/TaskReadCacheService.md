# TaskReadCacheService

> 7 nodes · cohesion 0.43

## Key Concepts

- **TaskReadCacheService** (11 connections) — `backend/src/common/redis/task-read-cache.service.ts`
- **.getOrLoad()** (6 connections) — `backend/src/common/redis/task-read-cache.service.ts`
- **.isEnabled()** (3 connections) — `backend/src/common/redis/task-read-cache.service.ts`
- **.cacheKey()** (2 connections) — `backend/src/common/redis/task-read-cache.service.ts`
- **.constructor()** (2 connections) — `backend/src/common/redis/task-read-cache.service.ts`
- **.ttlSec()** (2 connections) — `backend/src/common/redis/task-read-cache.service.ts`
- **Injectable** (1 connections)

## Relationships

- [RedisService](RedisService.md) (3 shared connections)
- [app.module.ts](app.module.ts.md) (2 shared connections)
- [reliability-test-helpers.ts](reliability-test-helpers.ts.md) (1 shared connections)
- [warehouse-tasks.service.ts](warehouse-tasks.service.ts.md) (1 shared connections)
- [NotificationsService](NotificationsService.md) (1 shared connections)
- [WarehouseTasksService](WarehouseTasksService.md) (1 shared connections)

## Source Files

- `backend/src/common/redis/task-read-cache.service.ts`

## Audit Trail

- EXTRACTED: 15 (83%)
- INFERRED: 3 (17%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*