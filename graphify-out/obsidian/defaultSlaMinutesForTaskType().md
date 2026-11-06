---
source_file: "backend/src/modules/warehouse-workflow/task-sla-defaults.ts"
type: "code"
community: "warehouse-tasks.service.ts"
location: "L15"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/warehouse-tasksservicets
---

# defaultSlaMinutesForTaskType()

## Connections
- [[dot-createInboundInstanceWithFirstReceiveTask()]] - `calls` [EXTRACTED]
- [[dot-createOutboundInstanceWithFirstPickTask()]] - `calls` [EXTRACTED]
- [[dot-enqueueDispatchTaskIfNeeded()]] - `calls` [EXTRACTED]
- [[dot-insertPutawayTask()]] - `calls` [EXTRACTED]
- [[dot-spawnPackIfNeeded()]] - `calls` [EXTRACTED]
- [[dot-spawnShippingDetailsIfNeeded()]] - `calls` [EXTRACTED]
- [[task-sla-defaults.ts]] - `contains` [EXTRACTED]
- [[workflow-engine.service.ts]] - `imports` [EXTRACTED]
- [[workflow-orchestration.service.ts]] - `imports` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/warehouse-tasksservicets