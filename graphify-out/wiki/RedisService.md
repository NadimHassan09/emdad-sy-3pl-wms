# RedisService

> 30 nodes · cohesion 0.16

## Key Concepts

- **RedisService** (32 connections) — `backend/src/common/redis/redis.service.ts`
- **.isEnabled()** (13 connections) — `backend/src/common/redis/redis.service.ts`
- **.ensureConnected()** (11 connections) — `backend/src/common/redis/redis.service.ts`
- **.k()** (11 connections) — `backend/src/common/redis/redis.service.ts`
- **.runExclusive()** (9 connections) — `backend/src/common/cron/cron-leader.service.ts`
- **.tryAcquire()** (8 connections) — `backend/src/common/cron/cron-leader.service.ts`
- **.getString()** (7 connections) — `backend/src/common/redis/redis.service.ts`
- **.bumpAdmin()** (7 connections) — `backend/src/modules/realtime/sync/module-versions.service.ts`
- **.release()** (6 connections) — `backend/src/common/cron/cron-leader.service.ts`
- **.incr()** (6 connections) — `backend/src/common/redis/redis.service.ts`
- **.bumpClient()** (6 connections) — `backend/src/modules/realtime/sync/module-versions.service.ts`
- **.set()** (6 connections) — `backend/src/modules/reports/reports-cache.service.ts`
- **.del()** (5 connections) — `backend/src/common/redis/redis.service.ts`
- **.hgetall()** (5 connections) — `backend/src/common/redis/redis.service.ts`
- **.hincrby()** (5 connections) — `backend/src/common/redis/redis.service.ts`
- **.setJson()** (5 connections) — `backend/src/common/redis/redis.service.ts`
- **.snapshotAdmin()** (5 connections) — `backend/src/modules/realtime/sync/module-versions.service.ts`
- **.snapshotClient()** (5 connections) — `backend/src/modules/realtime/sync/module-versions.service.ts`
- **.instanceId()** (4 connections) — `backend/src/common/cron/cron-leader.service.ts`
- **.expire()** (4 connections) — `backend/src/common/redis/redis.service.ts`
- **.getJson()** (4 connections) — `backend/src/common/redis/redis.service.ts`
- **.getOrSet()** (4 connections) — `backend/src/common/redis/redis.service.ts`
- **.setNx()** (4 connections) — `backend/src/common/redis/redis.service.ts`
- **.nextAdminSequence()** (4 connections) — `backend/src/modules/realtime/sync/module-versions.service.ts`
- **.get()** (4 connections) — `backend/src/modules/reports/reports-cache.service.ts`
- *... and 5 more nodes in this community*

## Relationships

- [@prisma/client](@prisma-client.md) (7 shared connections)
- [mutation-queue.service.ts](mutation-queue.service.ts.md) (7 shared connections)
- [CacheInvalidationService](CacheInvalidationService.md) (6 shared connections)
- [app.module.ts](app.module.ts.md) (5 shared connections)
- [NotificationsService](NotificationsService.md) (4 shared connections)
- [report-export.service.ts](report-export.service.ts.md) (4 shared connections)
- [MutationQueueService](MutationQueueService.md) (4 shared connections)
- [TaskReadCacheService](TaskReadCacheService.md) (3 shared connections)
- [CurrentUser](CurrentUser.md) (2 shared connections)
- [RunReportQueryDto](RunReportQueryDto.md) (2 shared connections)
- [BillingInvoiceCalculationService](BillingInvoiceCalculationService.md) (1 shared connections)
- [CycleCountSchedulerService](CycleCountSchedulerService.md) (1 shared connections)

## Source Files

- `backend/src/common/cron/cron-leader.service.ts`
- `backend/src/common/redis/redis.service.ts`
- `backend/src/modules/realtime/sync/module-versions.service.ts`
- `backend/src/modules/reports/reports-cache.service.ts`

## Audit Trail

- EXTRACTED: 78 (66%)
- INFERRED: 41 (34%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*