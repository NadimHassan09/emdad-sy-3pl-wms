---
type: community
cohesion: 0.21
members: 13
---

# CacheInvalidationService

**Cohesion:** 0.21 - loosely connected
**Members:** 13 nodes

## Members
- [[dot-afterStockOrLedgerMutation()]] - code - backend/src/common/redis/cache-invalidation.service.ts
- [[dot-constructor()_82]] - code - backend/src/common/redis/cache-invalidation.service.ts
- [[dot-deleteByPrefix()]] - code - backend/src/common/redis/redis.service.ts
- [[dot-invalidateBarcodeKey()]] - code - backend/src/common/redis/cache-invalidation.service.ts
- [[dot-invalidateLocationTrees()]] - code - backend/src/common/redis/cache-invalidation.service.ts
- [[dot-invalidateProducts()]] - code - backend/src/common/redis/cache-invalidation.service.ts
- [[CACHE_PREFIX]] - code - backend/src/common/redis/cache-invalidation.map.ts
- [[CacheInvalidationService]] - code - backend/src/common/redis/cache-invalidation.service.ts
- [[CachePrefix]] - code - backend/src/common/redis/cache-invalidation.map.ts
- [[INVALIDATION_BY_TRIGGER]] - code - backend/src/common/redis/cache-invalidation.map.ts
- [[Injectable_54]] - code
- [[cache-invalidation.map.ts]] - code - backend/src/common/redis/cache-invalidation.map.ts
- [[cache-invalidation.service.ts]] - code - backend/src/common/redis/cache-invalidation.service.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/CacheInvalidationService
SORT file.name ASC
```

## Connections to other communities
- 6 edges to [[_COMMUNITY_RedisService]]
- 4 edges to [[_COMMUNITY_WarehouseTasksService]]
- 3 edges to [[_COMMUNITY_app.module.ts]]
- 3 edges to [[_COMMUNITY_warehouse-tasks.service.ts]]
- 2 edges to [[_COMMUNITY_reliability-test-helpers.ts]]
- 2 edges to [[_COMMUNITY_@prismaclient]]
- 1 edge to [[_COMMUNITY_NotificationsService]]
- 1 edge to [[_COMMUNITY_@nestjscommon]]

## Top bridge nodes
- [[CacheInvalidationService]] - degree 15, connects to 6 communities
- [[cache-invalidation.service.ts]] - degree 11, connects to 6 communities
- [[dot-deleteByPrefix()]] - degree 8, connects to 2 communities
- [[dot-constructor()_82]] - degree 2, connects to 1 community
- [[dot-invalidateBarcodeKey()]] - degree 2, connects to 1 community