# CacheInvalidationService

> 13 nodes · cohesion 0.21

## Key Concepts

- **CacheInvalidationService** (15 connections) — `backend/src/common/redis/cache-invalidation.service.ts`
- **cache-invalidation.service.ts** (11 connections) — `backend/src/common/redis/cache-invalidation.service.ts`
- **.deleteByPrefix()** (8 connections) — `backend/src/common/redis/redis.service.ts`
- **cache-invalidation.map.ts** (4 connections) — `backend/src/common/redis/cache-invalidation.map.ts`
- **CACHE_PREFIX** (2 connections) — `backend/src/common/redis/cache-invalidation.map.ts`
- **INVALIDATION_BY_TRIGGER** (2 connections) — `backend/src/common/redis/cache-invalidation.map.ts`
- **.afterStockOrLedgerMutation()** (2 connections) — `backend/src/common/redis/cache-invalidation.service.ts`
- **.constructor()** (2 connections) — `backend/src/common/redis/cache-invalidation.service.ts`
- **.invalidateBarcodeKey()** (2 connections) — `backend/src/common/redis/cache-invalidation.service.ts`
- **.invalidateLocationTrees()** (2 connections) — `backend/src/common/redis/cache-invalidation.service.ts`
- **.invalidateProducts()** (2 connections) — `backend/src/common/redis/cache-invalidation.service.ts`
- **CachePrefix** (1 connections) — `backend/src/common/redis/cache-invalidation.map.ts`
- **Injectable** (1 connections)

## Relationships

- [RedisService](RedisService.md) (6 shared connections)
- [WarehouseTasksService](WarehouseTasksService.md) (4 shared connections)
- [app.module.ts](app.module.ts.md) (3 shared connections)
- [warehouse-tasks.service.ts](warehouse-tasks.service.ts.md) (3 shared connections)
- [reliability-test-helpers.ts](reliability-test-helpers.ts.md) (2 shared connections)
- [@prisma/client](@prisma-client.md) (2 shared connections)
- [@nestjs/common](@nestjs-common.md) (1 shared connections)
- [NotificationsService](NotificationsService.md) (1 shared connections)

## Source Files

- `backend/src/common/redis/cache-invalidation.map.ts`
- `backend/src/common/redis/cache-invalidation.service.ts`
- `backend/src/common/redis/redis.service.ts`

## Audit Trail

- EXTRACTED: 32 (84%)
- INFERRED: 6 (16%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*