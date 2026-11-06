---
type: community
cohesion: 0.18
members: 18
---

# MutationQueueService

**Cohesion:** 0.18 - loosely connected
**Members:** 18 nodes

## Members
- [[dot-attachMutationQueue()]] - code - backend/src/modules/realtime/realtime.service.ts
- [[dot-attachServer()]] - code - backend/src/modules/realtime/sync/mutation-queue.service.ts
- [[dot-constructor()_77]] - code - backend/src/modules/realtime/realtime.module.ts
- [[dot-drain()]] - code - backend/src/modules/realtime/sync/mutation-queue.service.ts
- [[dot-emitSystemVersion()]] - code - backend/src/modules/realtime/sync/realtime-sync-mode.service.ts
- [[dot-emitToAdmin()]] - code - backend/src/modules/realtime/sync/mutation-queue.service.ts
- [[dot-emitToCompany()]] - code - backend/src/modules/realtime/sync/mutation-queue.service.ts
- [[dot-emitToUser()]] - code - backend/src/modules/realtime/sync/mutation-queue.service.ts
- [[dot-enqueue()]] - code - backend/src/modules/realtime/sync/mutation-queue.service.ts
- [[dot-onModuleDestroy()_1]] - code - backend/src/modules/realtime/sync/mutation-queue.service.ts
- [[dot-onModuleInit()]] - code - backend/src/modules/realtime/realtime.module.ts
- [[dot-processBatch()]] - code - backend/src/modules/realtime/sync/mutation-queue.service.ts
- [[dot-publish()]] - code - backend/src/modules/realtime/sync/mutation-bus.service.ts
- [[dot-scheduleEmit()]] - code - backend/src/modules/realtime/sync/mutation-queue.service.ts
- [[dot-takeMergeBatch()]] - code - backend/src/modules/realtime/sync/mutation-queue.service.ts
- [[AppModuleId]] - code - backend/src/modules/realtime/sync/app-modules.ts
- [[Injectable_49]] - code
- [[MutationQueueService]] - code - backend/src/modules/realtime/sync/mutation-queue.service.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/MutationQueueService
SORT file.name ASC
```

## Connections to other communities
- 10 edges to [[_COMMUNITY_RealtimeService]]
- 7 edges to [[_COMMUNITY_app.module.ts]]
- 7 edges to [[_COMMUNITY_mutation-queue.service.ts]]
- 4 edges to [[_COMMUNITY_RedisService]]

## Top bridge nodes
- [[MutationQueueService]] - degree 20, connects to 3 communities
- [[dot-processBatch()]] - degree 10, connects to 3 communities
- [[AppModuleId]] - degree 10, connects to 2 communities
- [[dot-publish()]] - degree 4, connects to 2 communities
- [[dot-constructor()_77]] - degree 3, connects to 2 communities