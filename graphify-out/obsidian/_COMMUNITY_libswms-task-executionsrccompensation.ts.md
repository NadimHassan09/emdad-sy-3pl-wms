---
type: community
cohesion: 0.29
members: 7
---

# libs/wms-task-execution/src/compensation.ts

**Cohesion:** 0.29 - loosely connected
**Members:** 7 nodes

## Members
- [[CompensationAction]] - code - backend/libs/wms-task-execution/src/compensation.ts
- [[WorkflowRecoverRequest]] - code - backend/libs/wms-task-execution/src/compensation.ts
- [[compensationActionSchema]] - code - backend/libs/wms-task-execution/src/compensation.ts
- [[libswms-task-executionsrccompensation.ts]] - code - backend/libs/wms-task-execution/src/compensation.ts
- [[markDamagedQtyActionSchema]] - code - backend/libs/wms-task-execution/src/compensation.ts
- [[releaseReservationsOutboundActionSchema]] - code - backend/libs/wms-task-execution/src/compensation.ts
- [[workflowRecoverRequestSchema]] - code - backend/libs/wms-task-execution/src/compensation.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/libs/wms-task-execution/src/compensationts
SORT file.name ASC
```

## Connections to other communities
- 1 edge to [[_COMMUNITY_libswms-task-executionsrcregistry.ts]]
- 1 edge to [[_COMMUNITY_ref_zod]]

## Top bridge nodes
- [[libswms-task-executionsrccompensation.ts]] - degree 8, connects to 2 communities