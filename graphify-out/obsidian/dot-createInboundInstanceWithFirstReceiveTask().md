---
source_file: "backend/src/modules/warehouse-workflow/workflow-engine.service.ts"
type: "code"
community: "warehouse-tasks.service.ts"
location: "L40"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/warehouse-tasksservicets
---

# .createInboundInstanceWithFirstReceiveTask()

## Connections
- [[dot-startInboundWorkflow()]] - `calls` [INFERRED]
- [[dot-startInboundWorkflowTx()]] - `calls` [INFERRED]
- [[dot-validateResourceOwnership()]] - `calls` [INFERRED]
- [[AuthPrincipal]] - `references` [EXTRACTED]
- [[InvalidStateException]] - `calls` [EXTRACTED]
- [[WorkflowEngineService]] - `method` [EXTRACTED]
- [[defaultSlaMinutesForTaskType()]] - `calls` [EXTRACTED]
- [[findActiveWorkflowForReference()]] - `calls` [EXTRACTED]
- [[findFinishedWorkflowForReference()]] - `calls` [EXTRACTED]
- [[isActiveWorkflowUniqueViolation()]] - `calls` [EXTRACTED]
- [[loadWorkflowBootstrapBundle()]] - `calls` [EXTRACTED]
- [[lockWorkflowReferenceOrder()]] - `calls` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/warehouse-tasksservicets