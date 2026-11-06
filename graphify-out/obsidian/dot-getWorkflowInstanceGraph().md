---
source_file: "backend/src/modules/warehouse-workflow/workflow-bootstrap.service.ts"
type: "code"
community: "warehouse-tasks.service.ts"
location: "L136"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/warehouse-tasksservicets
---

# .getWorkflowInstanceGraph()

## Connections
- [[dot-getInstanceGraph()]] - `calls` [INFERRED]
- [[dot-getWorkflowInstanceGraphByReference()]] - `calls` [EXTRACTED]
- [[dot-validateResourceOwnership()]] - `calls` [INFERRED]
- [[AuthPrincipal]] - `references` [EXTRACTED]
- [[WorkflowBootstrapService]] - `method` [EXTRACTED]
- [[getFrontierBlockedReason()]] - `calls` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/warehouse-tasksservicets