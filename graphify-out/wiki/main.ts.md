# main.ts

> 32 nodes · cohesion 0.10

## Key Concepts

- **main.ts** (26 connections) — `backend/src/main.ts`
- **ApplicationLifecycleService** (13 connections) — `backend/src/common/lifecycle/application-lifecycle.service.ts`
- **bootstrap()** (11 connections) — `backend/src/main.ts`
- **RedisIoAdapter** (6 connections) — `backend/src/common/redis/redis-io.adapter.ts`
- **.ready()** (6 connections) — `backend/src/modules/observability/observability.service.ts`
- **response.interceptor.ts** (5 connections) — `backend/src/common/interceptors/response.interceptor.ts`
- **ResponseInterceptor** (5 connections) — `backend/src/common/interceptors/response.interceptor.ts`
- **.instanceId()** (5 connections) — `backend/src/common/lifecycle/application-lifecycle.service.ts`
- **.clusterInfo()** (4 connections) — `backend/src/common/lifecycle/application-lifecycle.service.ts`
- **.markShuttingDown()** (4 connections) — `backend/src/common/lifecycle/application-lifecycle.service.ts`
- **sanitizeValue()** (4 connections) — `backend/src/main.ts`
- **.isAcceptingTraffic()** (3 connections) — `backend/src/common/lifecycle/application-lifecycle.service.ts`
- **.markReady()** (3 connections) — `backend/src/common/lifecycle/application-lifecycle.service.ts`
- **installPm2ClusterSignals()** (3 connections) — `backend/src/main.ts`
- **sanitizeRequestPayload()** (3 connections) — `backend/src/main.ts`
- **cookie-parser** (3 connections) — `backend/package.json`
- **helmet** (3 connections) — `backend/package.json`
- **cookie-parser@^1.4.7** (2 connections) — `backend/package.json`
- **helmet@^8.2.0** (2 connections) — `backend/package.json`
- **.onApplicationShutdown()** (2 connections) — `backend/src/common/lifecycle/application-lifecycle.service.ts`
- **.connectToRedis()** (2 connections) — `backend/src/common/redis/redis-io.adapter.ts`
- **installRequestTracingAndStructuredLogs()** (2 connections) — `backend/src/main.ts`
- **validateStartupSafety()** (2 connections) — `backend/src/main.ts`
- **.getHealthSnapshot()** (2 connections) — `backend/src/modules/realtime/realtime.service.ts`
- **.intercept()** (1 connections) — `backend/src/common/interceptors/response.interceptor.ts`
- *... and 7 more nodes in this community*

## Relationships

- [observability.service.ts](observability.service.ts.md) (6 shared connections)
- [app.module.ts](app.module.ts.md) (6 shared connections)
- [backend/package.json](backend-package.json.md) (5 shared connections)
- [@nestjs/common](@nestjs-common.md) (3 shared connections)
- [RealtimeService](RealtimeService.md) (2 shared connections)
- [AllExceptionsFilter](AllExceptionsFilter.md) (2 shared connections)
- [class-validator](class-validator.md) (1 shared connections)
- [outbound.service.ts](outbound.service.ts.md) (1 shared connections)
- [reliability-test-helpers.ts](reliability-test-helpers.ts.md) (1 shared connections)
- [ref_node_path](ref_node_path.md) (1 shared connections)
- [RedisService](RedisService.md) (1 shared connections)

## Source Files

- `backend/package.json`
- `backend/src/common/interceptors/response.interceptor.ts`
- `backend/src/common/lifecycle/application-lifecycle.service.ts`
- `backend/src/common/redis/redis-io.adapter.ts`
- `backend/src/main.ts`
- `backend/src/modules/observability/observability.service.ts`
- `backend/src/modules/realtime/realtime.service.ts`

## Audit Trail

- EXTRACTED: 69 (87%)
- INFERRED: 10 (13%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*