---
source_file: "backend/src/modules/warehouse-workflow/workflow-orchestration.service.ts"
type: "code"
community: "warehouse-tasks.service.ts"
location: "L572"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/warehouse-tasksservicets
---

# .enqueueDispatchTaskIfNeeded()

## Connections
- [[dot-afterOutboundTask()]] - `calls` [EXTRACTED]
- [[dot-completeShippingDetailsAdmin()]] - `calls` [INFERRED]
- [[dot-nextNodeSequence()]] - `calls` [EXTRACTED]
- [[dot-resolvePickTaskIdForDispatchEnqueue()]] - `calls` [EXTRACTED]
- [[dot-skipTask()]] - `calls` [INFERRED]
- [[WorkflowOrchestrationService]] - `method` [EXTRACTED]
- [[defaultSlaMinutesForTaskType()]] - `calls` [EXTRACTED]
- [[readPickDraftPackingDestinationId()_1]] - `calls` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/warehouse-tasksservicets