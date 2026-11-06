---
source_file: "backend/src/modules/warehouse-workflow/workflow-engine.service.ts"
type: "code"
community: "warehouse-tasks.service.ts"
location: "L155"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/warehouse-tasksservicets
---

# .createOutboundInstanceWithFirstPickTask()

## Connections
- [[dot-startOutboundWorkflow()]] - `calls` [INFERRED]
- [[dot-startOutboundWorkflowTx()]] - `calls` [INFERRED]
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
- [[omsBlocksWarehouseExecution()]] - `calls` [EXTRACTED]
- [[outboundWarehouseClosed()]] - `calls` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/warehouse-tasksservicets