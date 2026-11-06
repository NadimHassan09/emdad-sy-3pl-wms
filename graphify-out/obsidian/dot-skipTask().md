---
source_file: "backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts"
type: "code"
community: "WarehouseTasksService"
location: "L1408"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/WarehouseTasksService
---

# .skipTask()

## Connections
- [[dot-afterTaskMutation()]] - `calls` [INFERRED]
- [[dot-appendEvent()]] - `calls` [EXTRACTED]
- [[dot-assertFrontierOnlyTx()]] - `calls` [EXTRACTED]
- [[dot-bumpStatus()]] - `calls` [EXTRACTED]
- [[dot-emitTaskUpdatedByTaskId()]] - `calls` [INFERRED]
- [[dot-enqueueDispatchTaskIfNeeded()]] - `calls` [INFERRED]
- [[dot-loadTaskEnvelope()]] - `calls` [EXTRACTED]
- [[dot-lockTask()]] - `calls` [EXTRACTED]
- [[dot-refreshWorkflowInstanceHealth()]] - `calls` [EXTRACTED]
- [[dot-skip()]] - `calls` [INFERRED]
- [[dot-spawnPutawayFromFullReceive()]] - `calls` [INFERRED]
- [[AuthPrincipal]] - `references` [EXTRACTED]
- [[WarehouseTasksService]] - `method` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/WarehouseTasksService