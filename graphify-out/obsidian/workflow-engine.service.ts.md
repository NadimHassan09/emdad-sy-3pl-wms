---
source_file: "backend/src/modules/warehouse-workflow/workflow-engine.service.ts"
type: "code"
community: "warehouse-tasks.service.ts"
location: "L1"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/warehouse-tasksservicets
---

# workflow-engine.service.ts

## Connections
- [[@nestjscommon]] - `imports_from` [EXTRACTED]
- [[@prismaclient]] - `imports_from` [EXTRACTED]
- [[AuthPrincipal]] - `imports` [EXTRACTED]
- [[CompanyAccessService]] - `imports` [EXTRACTED]
- [[InboundReceivingPayload]] - `imports` [EXTRACTED]
- [[InvalidStateException]] - `imports` [EXTRACTED]
- [[OutboundPickPayload]] - `imports` [EXTRACTED]
- [[WorkflowEngineService]] - `contains` [EXTRACTED]
- [[company-access.service.ts]] - `imports_from` [EXTRACTED]
- [[current-user.types.ts]] - `imports_from` [EXTRACTED]
- [[defaultSlaMinutesForTaskType()]] - `imports` [EXTRACTED]
- [[domain-exceptions.ts]] - `imports_from` [EXTRACTED]
- [[findActiveWorkflowForReference()]] - `imports` [EXTRACTED]
- [[findFinishedWorkflowForReference()]] - `imports` [EXTRACTED]
- [[isActiveWorkflowUniqueViolation()]] - `imports` [EXTRACTED]
- [[loadWorkflowBootstrapBundle()]] - `imports` [EXTRACTED]
- [[lockWorkflowReferenceOrder()]] - `imports` [EXTRACTED]
- [[oms-warehouse-guards.ts]] - `imports_from` [EXTRACTED]
- [[omsBlocksWarehouseExecution()]] - `imports` [EXTRACTED]
- [[outboundWarehouseClosed()]] - `imports` [EXTRACTED]
- [[reliability-test-helpers.ts]] - `imports_from` [EXTRACTED]
- [[same-workflow-path.unit.spec.ts]] - `imports_from` [EXTRACTED]
- [[task-sla-defaults.ts]] - `imports_from` [EXTRACTED]
- [[warehouse-workflow.module.ts]] - `imports_from` [EXTRACTED]
- [[workflow-active.util.ts]] - `imports_from` [EXTRACTED]
- [[workflow-bootstrap.service.ts]] - `imports_from` [EXTRACTED]
- [[workflow-payload.contracts.ts]] - `imports_from` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/warehouse-tasksservicets