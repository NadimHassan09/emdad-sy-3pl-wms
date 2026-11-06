---
source_file: "backend/src/modules/warehouse-workflow/workflow-orchestration.service.ts"
type: "code"
community: "warehouse-tasks.service.ts"
location: "L32"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/warehouse-tasksservicets
---

# .onTaskCompleted()

## Connections
- [[dot-adminQuietStartAndCompletePick()]] - `calls` [INFERRED]
- [[dot-afterInboundTask()]] - `calls` [EXTRACTED]
- [[dot-afterOutboundTask()]] - `calls` [EXTRACTED]
- [[dot-complete()_3]] - `calls` [INFERRED]
- [[dot-ensureOutboundFollowupTasksAfterPicks()]] - `calls` [INFERRED]
- [[dot-maybeCloseInboundWorkflow()]] - `calls` [EXTRACTED]
- [[OrderNotificationTarget]] - `references` [EXTRACTED]
- [[TaskCompleteBody_1]] - `references` [EXTRACTED]
- [[WorkflowOrchestrationService]] - `method` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/warehouse-tasksservicets