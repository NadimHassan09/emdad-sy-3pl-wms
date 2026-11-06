---
type: community
cohesion: 0.16
members: 30
---

# RedisService

**Cohesion:** 0.16 - loosely connected
**Members:** 30 nodes

## Members
- [[dot-bumpAdmin()]] - code - backend/src/modules/realtime/sync/module-versions.service.ts
- [[dot-bumpClient()]] - code - backend/src/modules/realtime/sync/module-versions.service.ts
- [[dot-constructor()_37]] - code - backend/src/common/redis/redis.service.ts
- [[dot-del()]] - code - backend/src/common/redis/redis.service.ts
- [[dot-ensureConnected()]] - code - backend/src/common/redis/redis.service.ts
- [[dot-expire()]] - code - backend/src/common/redis/redis.service.ts
- [[dot-get()]] - code - backend/src/modules/reports/reports-cache.service.ts
- [[dot-getJson()]] - code - backend/src/common/redis/redis.service.ts
- [[dot-getOrSet()]] - code - backend/src/common/redis/redis.service.ts
- [[dot-getString()]] - code - backend/src/common/redis/redis.service.ts
- [[dot-hgetall()]] - code - backend/src/common/redis/redis.service.ts
- [[dot-hincrby()]] - code - backend/src/common/redis/redis.service.ts
- [[dot-incr()]] - code - backend/src/common/redis/redis.service.ts
- [[dot-instanceId()_1]] - code - backend/src/common/cron/cron-leader.service.ts
- [[dot-isEnabled()]] - code - backend/src/common/redis/redis.service.ts
- [[dot-isPrimaryInstance()]] - code - backend/src/common/cron/cron-leader.service.ts
- [[dot-k()]] - code - backend/src/common/redis/redis.service.ts
- [[dot-key()]] - code - backend/src/modules/reports/reports-cache.service.ts
- [[dot-nextAdminSequence()]] - code - backend/src/modules/realtime/sync/module-versions.service.ts
- [[dot-onModuleDestroy()]] - code - backend/src/common/redis/redis.service.ts
- [[dot-release()]] - code - backend/src/common/cron/cron-leader.service.ts
- [[dot-runExclusive()]] - code - backend/src/common/cron/cron-leader.service.ts
- [[dot-set()]] - code - backend/src/modules/reports/reports-cache.service.ts
- [[dot-setJson()]] - code - backend/src/common/redis/redis.service.ts
- [[dot-setNx()]] - code - backend/src/common/redis/redis.service.ts
- [[dot-snapshotAdmin()]] - code - backend/src/modules/realtime/sync/module-versions.service.ts
- [[dot-snapshotClient()]] - code - backend/src/modules/realtime/sync/module-versions.service.ts
- [[dot-tryAcquire()]] - code - backend/src/common/cron/cron-leader.service.ts
- [[Injectable_16]] - code
- [[RedisService]] - code - backend/src/common/redis/redis.service.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/RedisService
SORT file.name ASC
```

## Connections to other communities
- 7 edges to [[_COMMUNITY_@prismaclient]]
- 7 edges to [[_COMMUNITY_mutation-queue.service.ts]]
- 6 edges to [[_COMMUNITY_CacheInvalidationService]]
- 5 edges to [[_COMMUNITY_app.module.ts]]
- 4 edges to [[_COMMUNITY_report-export.service.ts]]
- 4 edges to [[_COMMUNITY_MutationQueueService]]
- 4 edges to [[_COMMUNITY_NotificationsService]]
- 3 edges to [[_COMMUNITY_TaskReadCacheService]]
- 2 edges to [[_COMMUNITY_CurrentUser]]
- 2 edges to [[_COMMUNITY_RunReportQueryDto]]
- 1 edge to [[_COMMUNITY_observability.service.ts]]
- 1 edge to [[_COMMUNITY_RealtimeService]]
- 1 edge to [[_COMMUNITY_main.ts]]
- 1 edge to [[_COMMUNITY_BillingInvoiceCalculationService]]
- 1 edge to [[_COMMUNITY_CycleCountSchedulerService]]

## Top bridge nodes
- [[RedisService]] - degree 32, connects to 8 communities
- [[dot-runExclusive()]] - degree 9, connects to 4 communities
- [[dot-isEnabled()]] - degree 13, connects to 2 communities
- [[dot-bumpAdmin()]] - degree 7, connects to 2 communities
- [[dot-bumpClient()]] - degree 6, connects to 2 communities