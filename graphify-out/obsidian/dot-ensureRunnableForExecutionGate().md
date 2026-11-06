---
source_file: "backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts"
type: "code"
community: "WarehouseTasksService"
location: "L688"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/WarehouseTasksService
---

# .ensureRunnableForExecutionGate()

## Connections
- [[dot-assertOperatorAssignedToTask()]] - `calls` [EXTRACTED]
- [[dot-assertTaskWorkflowTenant()]] - `calls` [EXTRACTED]
- [[dot-canActivate()]] - `calls` [INFERRED]
- [[dot-isAdminActor()]] - `calls` [EXTRACTED]
- [[dot-rejectNotRunnable()]] - `calls` [EXTRACTED]
- [[dot-workerMeetsRequiredSkills()]] - `calls` [EXTRACTED]
- [[AuthPrincipal]] - `references` [EXTRACTED]
- [[WarehouseTasksService]] - `method` [EXTRACTED]
- [[computeRunnableTaskIds()]] - `calls` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/WarehouseTasksService