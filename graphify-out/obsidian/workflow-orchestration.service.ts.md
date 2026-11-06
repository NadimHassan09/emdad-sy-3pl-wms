---
source_file: "backend/src/modules/warehouse-workflow/workflow-orchestration.service.ts"
type: "code"
community: "warehouse-tasks.service.ts"
location: "L1"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/warehouse-tasksservicets
---

# workflow-orchestration.service.ts

## Connections
- [[@nestjscommon]] - `imports_from` [EXTRACTED]
- [[@prismaclient]] - `imports_from` [EXTRACTED]
- [[InboundPutawayPayload]] - `imports` [EXTRACTED]
- [[InboundQcTaskPayload]] - `imports` [EXTRACTED]
- [[InboundReceivingPayload]] - `imports` [EXTRACTED]
- [[OrderNotificationTarget]] - `imports` [EXTRACTED]
- [[PrismaService]] - `imports` [EXTRACTED]
- [[TaskCompleteBody_1]] - `imports` [EXTRACTED]
- [[WorkflowOrchestrationService]] - `contains` [EXTRACTED]
- [[defaultSlaMinutesForTaskType()]] - `imports` [EXTRACTED]
- [[execution-state-location.util.ts]] - `imports_from` [EXTRACTED]
- [[notifications.service.ts]] - `imports_from` [EXTRACTED]
- [[oms-warehouse-guards.ts]] - `imports_from` [EXTRACTED]
- [[outbound.service.ts]] - `imports_from` [EXTRACTED]
- [[outboundAllowsShippingDetailsSpawn()]] - `imports` [EXTRACTED]
- [[pickExecutionHasReservations()]] - `contains` [EXTRACTED]
- [[prisma.service.ts]] - `imports_from` [EXTRACTED]
- [[readPickDraftPackingDestinationId()_1]] - `imports` [EXTRACTED]
- [[reliability-test-helpers.ts]] - `imports_from` [EXTRACTED]
- [[task-payload.schema.ts]] - `imports_from` [EXTRACTED]
- [[task-sla-defaults.ts]] - `imports_from` [EXTRACTED]
- [[warehouse-tasks.service.ts]] - `imports_from` [EXTRACTED]
- [[warehouse-workflow.module.ts]] - `imports_from` [EXTRACTED]
- [[workflow-payload.contracts.ts]] - `imports_from` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/warehouse-tasksservicets