---
type: community
cohesion: 0.10
members: 32
---

# main.ts

**Cohesion:** 0.10 - loosely connected
**Members:** 32 nodes

## Members
- [[dot-clusterInfo()]] - code - backend/src/common/lifecycle/application-lifecycle.service.ts
- [[dot-connectToRedis()]] - code - backend/src/common/redis/redis-io.adapter.ts
- [[dot-constructor()_30]] - code - backend/src/common/redis/redis-io.adapter.ts
- [[dot-createIOServer()]] - code - backend/src/common/redis/redis-io.adapter.ts
- [[dot-getHealthSnapshot()]] - code - backend/src/modules/realtime/realtime.service.ts
- [[dot-instanceId()]] - code - backend/src/common/lifecycle/application-lifecycle.service.ts
- [[dot-intercept()]] - code - backend/src/common/interceptors/response.interceptor.ts
- [[dot-isAcceptingTraffic()]] - code - backend/src/common/lifecycle/application-lifecycle.service.ts
- [[dot-isShuttingDown()]] - code - backend/src/common/lifecycle/application-lifecycle.service.ts
- [[dot-markReady()]] - code - backend/src/common/lifecycle/application-lifecycle.service.ts
- [[dot-markShuttingDown()]] - code - backend/src/common/lifecycle/application-lifecycle.service.ts
- [[dot-onApplicationShutdown()]] - code - backend/src/common/lifecycle/application-lifecycle.service.ts
- [[dot-ready()]] - code - backend/src/modules/observability/observability.service.ts
- [[ApplicationLifecycleService]] - code - backend/src/common/lifecycle/application-lifecycle.service.ts
- [[Injectable_11]] - code
- [[Injectable_12]] - code
- [[JsonLike]] - code - backend/src/main.ts
- [[RedisIoAdapter]] - code - backend/src/common/redis/redis-io.adapter.ts
- [[ResponseInterceptor]] - code - backend/src/common/interceptors/response.interceptor.ts
- [[SuccessEnvelope]] - code - backend/src/common/interceptors/response.interceptor.ts
- [[bootstrap()]] - code - backend/src/main.ts
- [[cookie-parser]] - concept - backend/package.json
- [[cookie-parser@1.4.7]] - code - backend/package.json
- [[helmet]] - concept - backend/package.json
- [[helmet@8.2.0]] - code - backend/package.json
- [[installPm2ClusterSignals()]] - code - backend/src/main.ts
- [[installRequestTracingAndStructuredLogs()]] - code - backend/src/main.ts
- [[main.ts]] - code - backend/src/main.ts
- [[response.interceptor.ts]] - code - backend/src/common/interceptors/response.interceptor.ts
- [[sanitizeRequestPayload()]] - code - backend/src/main.ts
- [[sanitizeValue()]] - code - backend/src/main.ts
- [[validateStartupSafety()]] - code - backend/src/main.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/maints
SORT file.name ASC
```

## Connections to other communities
- 6 edges to [[_COMMUNITY_observability.service.ts]]
- 6 edges to [[_COMMUNITY_app.module.ts]]
- 5 edges to [[_COMMUNITY_backendpackage.json]]
- 3 edges to [[_COMMUNITY_@nestjscommon]]
- 2 edges to [[_COMMUNITY_RealtimeService]]
- 2 edges to [[_COMMUNITY_AllExceptionsFilter]]
- 1 edge to [[_COMMUNITY_RedisService]]
- 1 edge to [[_COMMUNITY_outbound.service.ts]]
- 1 edge to [[_COMMUNITY_class-validator]]
- 1 edge to [[_COMMUNITY_reliability-test-helpers.ts]]
- 1 edge to [[_COMMUNITY_ref_node_path]]

## Top bridge nodes
- [[main.ts]] - degree 26, connects to 8 communities
- [[ApplicationLifecycleService]] - degree 13, connects to 2 communities
- [[dot-ready()]] - degree 6, connects to 2 communities
- [[response.interceptor.ts]] - degree 5, connects to 2 communities
- [[bootstrap()]] - degree 11, connects to 1 community