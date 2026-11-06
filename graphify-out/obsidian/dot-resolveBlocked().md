---
source_file: "backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts"
type: "code"
community: "WarehouseTasksService"
location: "L2014"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/WarehouseTasksService
---

# .resolveBlocked()

## Connections
- [[dot-afterTaskAndStockMutation()]] - `calls` [INFERRED]
- [[dot-afterTaskMutation()]] - `calls` [INFERRED]
- [[dot-appendEvent()]] - `calls` [EXTRACTED]
- [[dot-bumpStatus()]] - `calls` [EXTRACTED]
- [[dot-emitTaskUpdatedByTaskId()]] - `calls` [INFERRED]
- [[dot-fromPrincipal()]] - `calls` [INFERRED]
- [[dot-loadTaskEnvelope()]] - `calls` [EXTRACTED]
- [[dot-lockTask()]] - `calls` [EXTRACTED]
- [[dot-logTx()]] - `calls` [INFERRED]
- [[dot-refreshWorkflowInstanceHealth()]] - `calls` [EXTRACTED]
- [[dot-releaseOutboundPickReservationsInWorkflow()]] - `calls` [EXTRACTED]
- [[dot-resolve()]] - `calls` [INFERRED]
- [[AuthPrincipal]] - `references` [EXTRACTED]
- [[ResolveTaskDto]] - `references` [EXTRACTED]
- [[WarehouseTasksService]] - `method` [EXTRACTED]
- [[canTransitionTask()]] - `calls` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/WarehouseTasksService