---
source_file: "backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts"
type: "code"
community: "WarehouseTasksService"
location: "L1621"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/WarehouseTasksService
---

# .adminQuietStartAndCompletePick()

## Connections
- [[dot-appendEvent()]] - `calls` [EXTRACTED]
- [[dot-applyPickRecordQuiet()]] - `calls` [INFERRED]
- [[dot-assertExclusiveActivePickInWorkflow()]] - `calls` [EXTRACTED]
- [[dot-assertTaskWorkflowTenant()]] - `calls` [EXTRACTED]
- [[dot-buildPickCompleteBodyFromReservations()]] - `calls` [EXTRACTED]
- [[dot-buildPickReservations()]] - `calls` [INFERRED]
- [[dot-completePickingAdmin()]] - `calls` [INFERRED]
- [[dot-isAdminActor()]] - `calls` [EXTRACTED]
- [[dot-loadActivePickReservations()]] - `calls` [INFERRED]
- [[dot-lockOutboundOrder()]] - `calls` [EXTRACTED]
- [[dot-lockTask()]] - `calls` [EXTRACTED]
- [[dot-lockWorkflowInstance()]] - `calls` [EXTRACTED]
- [[dot-lockWorkflowPickTasks()]] - `calls` [EXTRACTED]
- [[dot-onTaskCompleted()]] - `calls` [INFERRED]
- [[dot-parseExecState()]] - `calls` [EXTRACTED]
- [[dot-releaseTaskHeldReservations()]] - `calls` [EXTRACTED]
- [[AuthPrincipal]] - `references` [EXTRACTED]
- [[WarehouseTasksService]] - `method` [EXTRACTED]
- [[parsePickPayload()]] - `calls` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/WarehouseTasksService