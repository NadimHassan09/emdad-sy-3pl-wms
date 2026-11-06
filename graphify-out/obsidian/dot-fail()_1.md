---
source_file: "backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts"
type: "code"
community: "WarehouseTasksService"
location: "L1366"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/WarehouseTasksService
---

# .fail()

## Connections
- [[dot-afterTaskAndStockMutation()]] - `calls` [INFERRED]
- [[dot-afterTaskMutation()]] - `calls` [INFERRED]
- [[dot-appendEvent()]] - `calls` [EXTRACTED]
- [[dot-assertTaskWorkflowTenant()]] - `calls` [EXTRACTED]
- [[dot-bumpStatus()]] - `calls` [EXTRACTED]
- [[dot-emitTaskUpdatedByTaskId()]] - `calls` [INFERRED]
- [[dot-fail()]] - `calls` [INFERRED]
- [[dot-fromPrincipal()]] - `calls` [INFERRED]
- [[dot-loadTaskEnvelope()]] - `calls` [EXTRACTED]
- [[dot-lockTask()]] - `calls` [EXTRACTED]
- [[dot-logTx()]] - `calls` [INFERRED]
- [[dot-refreshWorkflowInstanceHealth()]] - `calls` [EXTRACTED]
- [[dot-releaseTaskHeldReservations()]] - `calls` [EXTRACTED]
- [[AuthPrincipal]] - `references` [EXTRACTED]
- [[WarehouseTasksService]] - `method` [EXTRACTED]
- [[canTransitionTask()]] - `calls` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/WarehouseTasksService