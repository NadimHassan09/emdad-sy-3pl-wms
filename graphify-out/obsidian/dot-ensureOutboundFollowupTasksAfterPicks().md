---
source_file: "backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts"
type: "code"
community: "WarehouseTasksService"
location: "L1783"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/WarehouseTasksService
---

# .ensureOutboundFollowupTasksAfterPicks()

## Connections
- [[dot-assertTaskWorkflowTenant()]] - `calls` [EXTRACTED]
- [[dot-buildPickCompleteBodyFromReservations()]] - `calls` [EXTRACTED]
- [[dot-ensurePickingFollowups()]] - `calls` [INFERRED]
- [[dot-isAdminActor()]] - `calls` [EXTRACTED]
- [[dot-onTaskCompleted()]] - `calls` [INFERRED]
- [[dot-parseExecState()]] - `calls` [EXTRACTED]
- [[AuthPrincipal]] - `references` [EXTRACTED]
- [[WarehouseTasksService]] - `method` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/WarehouseTasksService