---
type: community
cohesion: 0.43
members: 7
---

# TaskReadCacheService

**Cohesion:** 0.43 - moderately connected
**Members:** 7 nodes

## Members
- [[dot-cacheKey()]] - code - backend/src/common/redis/task-read-cache.service.ts
- [[dot-constructor()_112]] - code - backend/src/common/redis/task-read-cache.service.ts
- [[dot-getOrLoad()]] - code - backend/src/common/redis/task-read-cache.service.ts
- [[dot-isEnabled()_2]] - code - backend/src/common/redis/task-read-cache.service.ts
- [[dot-ttlSec()]] - code - backend/src/common/redis/task-read-cache.service.ts
- [[Injectable_72]] - code
- [[TaskReadCacheService]] - code - backend/src/common/redis/task-read-cache.service.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/TaskReadCacheService
SORT file.name ASC
```

## Connections to other communities
- 3 edges to [[_COMMUNITY_RedisService]]
- 2 edges to [[_COMMUNITY_app.module.ts]]
- 1 edge to [[_COMMUNITY_reliability-test-helpers.ts]]
- 1 edge to [[_COMMUNITY_warehouse-tasks.service.ts]]
- 1 edge to [[_COMMUNITY_NotificationsService]]
- 1 edge to [[_COMMUNITY_WarehouseTasksService]]

## Top bridge nodes
- [[TaskReadCacheService]] - degree 11, connects to 4 communities
- [[dot-getOrLoad()]] - degree 6, connects to 2 communities
- [[dot-isEnabled()_2]] - degree 3, connects to 1 community
- [[dot-constructor()_112]] - degree 2, connects to 1 community