---
source_file: "backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts"
type: "code"
community: "WarehouseTasksService"
location: "L74"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/WarehouseTasksService
---

# .assertTaskWorkflowTenant()

## Connections
- [[dot-adminQuietStartAndCompletePick()]] - `calls` [EXTRACTED]
- [[dot-assertSameCompany()]] - `calls` [INFERRED]
- [[dot-assign()_1]] - `calls` [EXTRACTED]
- [[dot-cancel()_5]] - `calls` [EXTRACTED]
- [[dot-complete()_3]] - `calls` [EXTRACTED]
- [[dot-ensureOutboundFollowupTasksAfterPicks()]] - `calls` [EXTRACTED]
- [[dot-ensureRunnableForExecutionGate()]] - `calls` [EXTRACTED]
- [[dot-fail()_1]] - `calls` [EXTRACTED]
- [[dot-fetchTaskAuthorized()]] - `calls` [EXTRACTED]
- [[dot-leaseAcquire()_1]] - `calls` [EXTRACTED]
- [[dot-leaseRelease()_1]] - `calls` [EXTRACTED]
- [[dot-patchPlan()_1]] - `calls` [EXTRACTED]
- [[dot-patchProgress()_1]] - `calls` [EXTRACTED]
- [[dot-unassign()_1]] - `calls` [EXTRACTED]
- [[AuthPrincipal]] - `references` [EXTRACTED]
- [[WarehouseTasksService]] - `method` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/WarehouseTasksService