---
type: community
cohesion: 0.18
members: 19
---

# backend/src/vendor/wms-task-execution/registry.ts

**Cohesion:** 0.18 - loosely connected
**Members:** 19 nodes

## Members
- [[dot-constructor()_74]] - code - backend/src/vendor/wms-task-execution/registry.ts
- [[ParseCompleteFailure_2]] - code - backend/src/vendor/wms-task-execution/registry.ts
- [[ParseCompleteSuccess_2]] - code - backend/src/vendor/wms-task-execution/registry.ts
- [[SUPPORTED_COMPLETE_VERSIONS_2]] - code - backend/src/vendor/wms-task-execution/registry.ts
- [[TaskCompleteRequest_2]] - code - backend/src/vendor/wms-task-execution/request.ts
- [[TaskExecutionValidationError_2]] - code - backend/src/vendor/wms-task-execution/registry.ts
- [[TaskProgressRequest_2]] - code - backend/src/vendor/wms-task-execution/progress.ts
- [[backendsrcvendorwms-task-executionindex.ts]] - code - backend/src/vendor/wms-task-execution/index.ts
- [[backendsrcvendorwms-task-executionprogress.ts]] - code - backend/src/vendor/wms-task-execution/progress.ts
- [[backendsrcvendorwms-task-executionregistry.ts]] - code - backend/src/vendor/wms-task-execution/registry.ts
- [[backendsrcvendorwms-task-executionrequest.ts]] - code - backend/src/vendor/wms-task-execution/request.ts
- [[parseTaskComplete()_2]] - code - backend/src/vendor/wms-task-execution/registry.ts
- [[safeParseTaskComplete()_2]] - code - backend/src/vendor/wms-task-execution/registry.ts
- [[stripCompleteEnvelope()_2]] - code - backend/src/vendor/wms-task-execution/request.ts
- [[taskCompleteBodySchema]] - code - backend/src/vendor/wms-task-execution/complete.ts
- [[taskCompleteRequestSchema_2]] - code - backend/src/vendor/wms-task-execution/request.ts
- [[taskExecutionMetadataSchema_2]] - code - backend/src/vendor/wms-task-execution/request.ts
- [[taskProgressRequestSchema_2]] - code - backend/src/vendor/wms-task-execution/progress.ts
- [[validateCompleteVersion()_2]] - code - backend/src/vendor/wms-task-execution/registry.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/backend/src/vendor/wms-task-execution/registryts
SORT file.name ASC
```

## Connections to other communities
- 4 edges to [[_COMMUNITY_backendsrcvendorwms-task-executioncomplete.ts]]
- 3 edges to [[_COMMUNITY_task-inventory-effects.service.ts]]
- 3 edges to [[_COMMUNITY_warehouse-tasks.service.ts]]
- 3 edges to [[_COMMUNITY_ref_zod]]
- 1 edge to [[_COMMUNITY_WarehouseTasksService]]
- 1 edge to [[_COMMUNITY_backendsrcvendorwms-task-executioncompensation.ts]]

## Top bridge nodes
- [[backendsrcvendorwms-task-executionregistry.ts]] - degree 15, connects to 3 communities
- [[backendsrcvendorwms-task-executionrequest.ts]] - degree 11, connects to 3 communities
- [[backendsrcvendorwms-task-executionindex.ts]] - degree 6, connects to 3 communities
- [[safeParseTaskComplete()_2]] - degree 4, connects to 2 communities
- [[backendsrcvendorwms-task-executionprogress.ts]] - degree 6, connects to 1 community