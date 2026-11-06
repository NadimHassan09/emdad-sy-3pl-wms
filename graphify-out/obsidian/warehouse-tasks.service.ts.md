---
source_file: "backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts"
type: "code"
community: "warehouse-tasks.service.ts"
location: "L1"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/warehouse-tasksservicets
---

# warehouse-tasks.service.ts

## Connections
- [[@nestjscommon]] - `imports_from` [EXTRACTED]
- [[@prismaclient]] - `imports_from` [EXTRACTED]
- [[AuditLogService]] - `imports` [EXTRACTED]
- [[AuthPrincipal]] - `imports` [EXTRACTED]
- [[BillingInvoiceCalculationService]] - `imports` [EXTRACTED]
- [[CacheInvalidationService]] - `imports` [EXTRACTED]
- [[CompanyAccessService]] - `imports` [EXTRACTED]
- [[DocumentGenerationService]] - `imports` [EXTRACTED]
- [[ExecState]] - `contains` [EXTRACTED]
- [[InboundPutawayPayload]] - `imports` [EXTRACTED]
- [[InboundQcTaskPayload]] - `imports` [EXTRACTED]
- [[NotificationsService]] - `imports` [EXTRACTED]
- [[OrderNotificationTarget]] - `imports` [EXTRACTED]
- [[OutboundDispatchPayload]] - `imports` [EXTRACTED]
- [[OutboundPickPayload]] - `imports` [EXTRACTED]
- [[PrismaService]] - `imports` [EXTRACTED]
- [[RUNN_BLOCKED_ASSIGNMENT_REQUIRED]] - `imports` [EXTRACTED]
- [[RUNN_BLOCKED_NOT_ON_FRONT]] - `imports` [EXTRACTED]
- [[RUNN_BLOCKED_SKILL_GAP]] - `imports` [EXTRACTED]
- [[RealtimeService]] - `imports` [EXTRACTED]
- [[ReservationSnapshot]] - `imports` [EXTRACTED]
- [[ResolveTaskDto]] - `imports` [EXTRACTED]
- [[TaskCompleteBody_1]] - `imports` [EXTRACTED]
- [[TaskInventoryEffectsService]] - `imports` [EXTRACTED]
- [[TaskMutationResponseEnvelope]] - `imports` [EXTRACTED]
- [[TaskReadCacheService]] - `imports` [EXTRACTED]
- [[WarehouseTasksService]] - `contains` [EXTRACTED]
- [[WorkflowOrchestrationService]] - `imports` [EXTRACTED]
- [[audit-log.service.ts]] - `imports_from` [EXTRACTED]
- [[billing-invoice-calculation.service.ts]] - `imports_from` [EXTRACTED]
- [[billing-recalculation-triggers.util.ts]] - `imports_from` [EXTRACTED]
- [[billingTriggerForWarehouseTask()]] - `imports` [EXTRACTED]
- [[cache-invalidation.service.ts]] - `imports_from` [EXTRACTED]
- [[canTransitionTask()]] - `imports` [EXTRACTED]
- [[company-access.service.ts]] - `imports_from` [EXTRACTED]
- [[computeRunnableTaskIds()]] - `imports` [EXTRACTED]
- [[current-user.types.ts]] - `imports_from` [EXTRACTED]
- [[document-generation.service.ts]] - `imports_from` [EXTRACTED]
- [[getFrontierBlockedReason()]] - `imports` [EXTRACTED]
- [[inbound.service.ts]] - `imports_from` [EXTRACTED]
- [[isRecord()_6]] - `contains` [EXTRACTED]
- [[notifications.service.ts]] - `imports_from` [EXTRACTED]
- [[outbound.service.ts]] - `imports_from` [EXTRACTED]
- [[outboundIdFromPackPayload()]] - `contains` [EXTRACTED]
- [[parseDispatchTaskPayloadAllowLegacy()]] - `contains` [EXTRACTED]
- [[parsePickPayload()]] - `contains` [EXTRACTED]
- [[prisma.service.ts]] - `imports_from` [EXTRACTED]
- [[realtime.service.ts]] - `imports_from` [EXTRACTED]
- [[receivingOrderId()]] - `contains` [EXTRACTED]
- [[reliability-test-helpers.ts]] - `imports_from` [EXTRACTED]
- [[resolve-task.dto.ts]] - `imports_from` [EXTRACTED]
- [[safeParseTaskComplete()_2]] - `imports` [EXTRACTED]
- [[sourceMapFromPutawayPayload()]] - `contains` [EXTRACTED]
- [[stagingMapFromReceivingPayload()]] - `contains` [EXTRACTED]
- [[task-inventory-effects.service.ts]] - `imports_from` [EXTRACTED]
- [[task-mutation-envelope.dto.ts]] - `imports_from` [EXTRACTED]
- [[task-payload.schema.ts]] - `imports_from` [EXTRACTED]
- [[task-read-cache.service.ts]] - `imports_from` [EXTRACTED]
- [[task-runnable.util.ts]] - `imports_from` [EXTRACTED]
- [[task-transitions.ts]] - `imports_from` [EXTRACTED]
- [[taskProgressRequestSchema_2]] - `imports` [EXTRACTED]
- [[warehouse-tasks-list.service.unit.spec.ts]] - `imports_from` [EXTRACTED]
- [[warehouse-tasks.controller.ts]] - `imports_from` [EXTRACTED]
- [[warehouse-workflow.module.ts]] - `imports_from` [EXTRACTED]
- [[workflow-execution-gate.guard.ts]] - `imports_from` [EXTRACTED]
- [[workflow-orchestration.service.ts]] - `imports_from` [EXTRACTED]
- [[workflow-payload.contracts.ts]] - `imports_from` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/warehouse-tasksservicets