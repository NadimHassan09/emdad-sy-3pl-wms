---
type: community
cohesion: 0.03
members: 127
---

# warehouse-tasks.service.ts

**Cohesion:** 0.03 - loosely connected
**Members:** 127 nodes

## Members
- [[dot-afterInboundTask()]] - code - backend/src/modules/warehouse-workflow/workflow-orchestration.service.ts
- [[dot-afterOutboundTask()]] - code - backend/src/modules/warehouse-workflow/workflow-orchestration.service.ts
- [[dot-afterQc()]] - code - backend/src/modules/warehouse-workflow/workflow-orchestration.service.ts
- [[dot-afterReceiving()]] - code - backend/src/modules/warehouse-workflow/workflow-orchestration.service.ts
- [[dot-constructor()_58]] - code - backend/src/modules/warehouse-workflow/workflow.controller.ts
- [[dot-constructor()_59]] - code - backend/src/modules/warehouse-workflow/workflow-orchestration.service.ts
- [[dot-constructor()_60]] - code - backend/src/modules/warehouse-workflow/workflow-recovery.service.ts
- [[dot-countOpenTasks()]] - code - backend/src/modules/warehouse-workflow/workflow-orchestration.service.ts
- [[dot-createInboundInstanceWithFirstReceiveTask()]] - code - backend/src/modules/warehouse-workflow/workflow-engine.service.ts
- [[dot-createOutboundInstanceWithFirstPickTask()]] - code - backend/src/modules/warehouse-workflow/workflow-engine.service.ts
- [[dot-enqueueDispatchTaskIfNeeded()]] - code - backend/src/modules/warehouse-workflow/workflow-orchestration.service.ts
- [[dot-getContextSettings()]] - code - backend/src/modules/warehouse-workflow/workflow.controller.ts
- [[dot-getInstanceGraph()]] - code - backend/src/modules/warehouse-workflow/workflow.controller.ts
- [[dot-getInstanceGraphByReference()]] - code - backend/src/modules/warehouse-workflow/workflow.controller.ts
- [[dot-getTimeline()]] - code - backend/src/modules/warehouse-workflow/workflow.controller.ts
- [[dot-getWorkflowContextSettings()]] - code - backend/src/modules/warehouse-workflow/workflow-bootstrap.service.ts
- [[dot-getWorkflowInstanceGraph()]] - code - backend/src/modules/warehouse-workflow/workflow-bootstrap.service.ts
- [[dot-getWorkflowInstanceGraphByReference()]] - code - backend/src/modules/warehouse-workflow/workflow-bootstrap.service.ts
- [[dot-getWorkflowTimeline()]] - code - backend/src/modules/warehouse-workflow/workflow-bootstrap.service.ts
- [[dot-insertPutawayTask()]] - code - backend/src/modules/warehouse-workflow/workflow-orchestration.service.ts
- [[dot-maybeCloseInboundWorkflow()]] - code - backend/src/modules/warehouse-workflow/workflow-orchestration.service.ts
- [[dot-nextNodeSequence()]] - code - backend/src/modules/warehouse-workflow/workflow-orchestration.service.ts
- [[dot-onTaskCompleted()]] - code - backend/src/modules/warehouse-workflow/workflow-orchestration.service.ts
- [[dot-recoverWorkflowInstance()]] - code - backend/src/modules/warehouse-workflow/workflow.controller.ts
- [[dot-recoverWorkflowInstance()_1]] - code - backend/src/modules/warehouse-workflow/workflow-recovery.service.ts
- [[dot-resolvePickTaskIdForDispatchEnqueue()]] - code - backend/src/modules/warehouse-workflow/workflow-orchestration.service.ts
- [[dot-resolveStagingLotIdForPutaway()]] - code - backend/src/modules/warehouse-workflow/workflow-orchestration.service.ts
- [[dot-spawnPackIfNeeded()]] - code - backend/src/modules/warehouse-workflow/workflow-orchestration.service.ts
- [[dot-spawnPutawayFromFullReceive()]] - code - backend/src/modules/warehouse-workflow/workflow-orchestration.service.ts
- [[dot-spawnShippingDetailsIfNeeded()]] - code - backend/src/modules/warehouse-workflow/workflow-orchestration.service.ts
- [[dot-startInbound()]] - code - backend/src/modules/warehouse-workflow/workflow.controller.ts
- [[dot-startInboundWorkflow()]] - code - backend/src/modules/warehouse-workflow/workflow-bootstrap.service.ts
- [[dot-startInboundWorkflowTx()]] - code - backend/src/modules/warehouse-workflow/workflow-bootstrap.service.ts
- [[dot-startOutbound()]] - code - backend/src/modules/warehouse-workflow/workflow.controller.ts
- [[dot-startOutboundWorkflow()]] - code - backend/src/modules/warehouse-workflow/workflow-bootstrap.service.ts
- [[dot-startOutboundWorkflowTx()]] - code - backend/src/modules/warehouse-workflow/workflow-bootstrap.service.ts
- [[Body_5]] - code
- [[Controller_11]] - code
- [[DEFAULT_SLA_MINUTES_BY_TASK_TYPE]] - code - backend/src/modules/warehouse-workflow/task-sla-defaults.ts
- [[ExecState]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts
- [[FullTaskRow]] - code - backend/src/modules/warehouse-workflow/workflow-timeline.helpers.ts
- [[Get_8]] - code
- [[INBOUND_TEMPLATE]] - code - backend/src/modules/warehouse-workflow/workflow-timeline.helpers.ts
- [[InboundPutawayPayload]] - code - backend/src/modules/warehouse-workflow/workflow-payload.contracts.ts
- [[InboundQcTaskPayload]] - code - backend/src/modules/warehouse-workflow/workflow-payload.contracts.ts
- [[InboundReceivingPayload]] - code - backend/src/modules/warehouse-workflow/workflow-payload.contracts.ts
- [[Injectable_31]] - code
- [[Injectable_32]] - code
- [[Injectable_33]] - code
- [[IsObject_2]] - code
- [[IsOptional_16]] - code
- [[IsUUID_2]] - code
- [[OMS_BLOCKS_WAREHOUSE_EXECUTION]] - code - backend/src/modules/oms/oms-warehouse-guards.ts
- [[OUTBOUND_SHIPPING_DETAILS_SPAWNABLE]] - code - backend/src/modules/oms/oms-warehouse-guards.ts
- [[OUTBOUND_TEMPLATE]] - code - backend/src/modules/warehouse-workflow/workflow-timeline.helpers.ts
- [[OUTBOUND_WAREHOUSE_CLOSED]] - code - backend/src/modules/oms/oms-warehouse-guards.ts
- [[OrderNotificationTarget]] - code - backend/src/modules/notifications/notifications.service.ts
- [[OutboundDispatchPayload]] - code - backend/src/modules/warehouse-workflow/workflow-payload.contracts.ts
- [[OutboundPickPayload]] - code - backend/src/modules/warehouse-workflow/workflow-payload.contracts.ts
- [[Param_6]] - code
- [[Post_6]] - code
- [[Query_7]] - code
- [[RUNN_BLOCKED_ASSIGNMENT_REQUIRED]] - code - backend/src/modules/warehouse-workflow/task-runnable.util.ts
- [[RUNN_BLOCKED_NOT_ON_FRONT]] - code - backend/src/modules/warehouse-workflow/task-runnable.util.ts
- [[RUNN_BLOCKED_SKILL_GAP]] - code - backend/src/modules/warehouse-workflow/task-runnable.util.ts
- [[RunnabilityBlockedReason]] - code - backend/src/modules/warehouse-workflow/task-runnable.util.ts
- [[StartWorkflowBodyDto]] - code - backend/src/modules/warehouse-workflow/dto/start-workflow.dto.ts
- [[TERMINAL_2]] - code - backend/src/modules/warehouse-workflow/workflow-timeline.helpers.ts
- [[TaskLight]] - code - backend/src/modules/warehouse-workflow/workflow-timeline.helpers.ts
- [[TaskMutationResponseEnvelope]] - code - backend/src/modules/warehouse-workflow/task-mutation-envelope.dto.ts
- [[TaskRow]] - code - backend/src/modules/realtime/realtime-task.payload.ts
- [[TaskRunnableShape]] - code - backend/src/modules/warehouse-workflow/task-runnable.util.ts
- [[TimelineStepUiStatus]] - code - backend/src/modules/warehouse-workflow/workflow-timeline.helpers.ts
- [[UseGuards_7]] - code
- [[WORKFLOW_ACTIVE_STATUSES]] - code - backend/src/modules/warehouse-workflow/workflow-active.util.ts
- [[WORKFLOW_ACTIVE_UNIQUE_INDEX]] - code - backend/src/modules/warehouse-workflow/workflow-active.util.ts
- [[WorkflowBootstrapService]] - code - backend/src/modules/warehouse-workflow/workflow-bootstrap.service.ts
- [[WorkflowController]] - code - backend/src/modules/warehouse-workflow/workflow.controller.ts
- [[WorkflowOrchestrationService]] - code - backend/src/modules/warehouse-workflow/workflow-orchestration.service.ts
- [[WorkflowRecoveryService]] - code - backend/src/modules/warehouse-workflow/workflow-recovery.service.ts
- [[WorkflowTimelineStepDto]] - code - backend/src/modules/warehouse-workflow/workflow-timeline.helpers.ts
- [[activeWorkflowWhere()]] - code - backend/src/modules/warehouse-workflow/workflow-active.util.ts
- [[buildTaskListPayload()]] - code - backend/src/modules/realtime/realtime-task.payload.ts
- [[buildWorkflowTimelineSteps()]] - code - backend/src/modules/warehouse-workflow/workflow-timeline.helpers.ts
- [[computeRunnableTaskIds()]] - code - backend/src/modules/warehouse-workflow/task-runnable.util.ts
- [[defaultSlaMinutesForTaskType()]] - code - backend/src/modules/warehouse-workflow/task-sla-defaults.ts
- [[deriveStepStatus()]] - code - backend/src/modules/warehouse-workflow/workflow-timeline.helpers.ts
- [[execution-state-location.util.ts]] - code - backend/src/modules/warehouse-workflow/execution-state-location.util.ts
- [[findActiveWorkflowForReference()]] - code - backend/src/modules/warehouse-workflow/workflow-active.util.ts
- [[findFinishedWorkflowForReference()]] - code - backend/src/modules/warehouse-workflow/workflow-active.util.ts
- [[getFrontierBlockedReason()]] - code - backend/src/modules/warehouse-workflow/task-runnable.util.ts
- [[isActionable()]] - code - backend/src/modules/warehouse-workflow/task-runnable.util.ts
- [[isActiveWorkflowUniqueViolation()]] - code - backend/src/modules/warehouse-workflow/workflow-active.util.ts
- [[isRecord()_4]] - code - backend/src/modules/warehouse-workflow/execution-state-location.util.ts
- [[isRecord()_5]] - code - backend/src/modules/warehouse-workflow/workflow-recovery.service.ts
- [[isTerminal()]] - code - backend/src/modules/warehouse-workflow/task-runnable.util.ts
- [[isWorkflowActiveStatus()]] - code - backend/src/modules/warehouse-workflow/workflow-active.util.ts
- [[loadWorkflowBootstrapBundle()]] - code - backend/src/modules/warehouse-workflow/workflow-active.util.ts
- [[lockWorkflowReferenceOrder()]] - code - backend/src/modules/warehouse-workflow/workflow-active.util.ts
- [[matchesForStep()]] - code - backend/src/modules/warehouse-workflow/workflow-timeline.helpers.ts
- [[matchesTypes()]] - code - backend/src/modules/warehouse-workflow/workflow-timeline.helpers.ts
- [[oms-warehouse-guards.ts]] - code - backend/src/modules/oms/oms-warehouse-guards.ts
- [[oms-warehouse-guards.unit.spec.ts]] - code - backend/src/modules/oms/oms-warehouse-guards.unit.spec.ts
- [[omsBlocksWarehouseExecution()]] - code - backend/src/modules/oms/oms-warehouse-guards.ts
- [[outboundAllowsShippingDetailsSpawn()]] - code - backend/src/modules/oms/oms-warehouse-guards.ts
- [[outboundWarehouseClosed()]] - code - backend/src/modules/oms/oms-warehouse-guards.ts
- [[pickExecutionHasReservations()]] - code - backend/src/modules/warehouse-workflow/workflow-orchestration.service.ts
- [[readPackDraftPackingStationId()_1]] - code - backend/src/modules/warehouse-workflow/execution-state-location.util.ts
- [[readPickDraftPackingDestinationId()_1]] - code - backend/src/modules/warehouse-workflow/execution-state-location.util.ts
- [[realtime-task.payload.ts]] - code - backend/src/modules/realtime/realtime-task.payload.ts
- [[reservationRowsFromExec()_1]] - code - backend/src/modules/warehouse-workflow/workflow-recovery.service.ts
- [[start-workflow.dto.ts]] - code - backend/src/modules/warehouse-workflow/dto/start-workflow.dto.ts
- [[task-mutation-envelope.dto.ts]] - code - backend/src/modules/warehouse-workflow/task-mutation-envelope.dto.ts
- [[task-payload.schema.ts]] - code - backend/src/modules/warehouse-workflow/task-payload.schema.ts
- [[task-runnable.util.ts]] - code - backend/src/modules/warehouse-workflow/task-runnable.util.ts
- [[task-sla-defaults.ts]] - code - backend/src/modules/warehouse-workflow/task-sla-defaults.ts
- [[task-transitions.ts]] - code - backend/src/modules/warehouse-workflow/task-transitions.ts
- [[terminal]] - code - backend/src/modules/warehouse-workflow/task-runnable.util.ts
- [[terminal_1]] - code - backend/src/modules/warehouse-workflow/task-transitions.ts
- [[warehouse-tasks.service.ts]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts
- [[workflow-active.util.ts]] - code - backend/src/modules/warehouse-workflow/workflow-active.util.ts
- [[workflow-bootstrap.service.ts]] - code - backend/src/modules/warehouse-workflow/workflow-bootstrap.service.ts
- [[workflow-engine.service.ts]] - code - backend/src/modules/warehouse-workflow/workflow-engine.service.ts
- [[workflow-orchestration.service.ts]] - code - backend/src/modules/warehouse-workflow/workflow-orchestration.service.ts
- [[workflow-payload.contracts.ts]] - code - backend/src/modules/warehouse-workflow/workflow-payload.contracts.ts
- [[workflow-timeline.helpers.ts]] - code - backend/src/modules/warehouse-workflow/workflow-timeline.helpers.ts
- [[workflow.controller.ts]] - code - backend/src/modules/warehouse-workflow/workflow.controller.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/warehouse-tasksservicets
SORT file.name ASC
```

## Connections to other communities
- 37 edges to [[_COMMUNITY_@prismaclient]]
- 22 edges to [[_COMMUNITY_AuthPrincipal]]
- 21 edges to [[_COMMUNITY_WarehouseTasksService]]
- 19 edges to [[_COMMUNITY_outbound.service.ts]]
- 17 edges to [[_COMMUNITY_task-inventory-effects.service.ts]]
- 12 edges to [[_COMMUNITY_reliability-test-helpers.ts]]
- 11 edges to [[_COMMUNITY_app.module.ts]]
- 9 edges to [[_COMMUNITY_@nestjscommon]]
- 8 edges to [[_COMMUNITY_CurrentUser]]
- 6 edges to [[_COMMUNITY_dashboard.service.ts]]
- 5 edges to [[_COMMUNITY_NotificationsService]]
- 4 edges to [[_COMMUNITY_BillingInvoiceCalculationService]]
- 4 edges to [[_COMMUNITY_RealtimeService]]
- 4 edges to [[_COMMUNITY_dot-validateResourceOwnership]]
- 3 edges to [[_COMMUNITY_CacheInvalidationService]]
- 3 edges to [[_COMMUNITY_backendsrcvendorwms-task-executionregistry.ts]]
- 2 edges to [[_COMMUNITY_grn-pdf.service.ts]]
- 2 edges to [[_COMMUNITY_AuditLogService]]
- 2 edges to [[_COMMUNITY_ResolveTaskDto]]
- 2 edges to [[_COMMUNITY_dot-fromPrincipal]]
- 2 edges to [[_COMMUNITY_warehouse-tasks.controller.ts]]
- 1 edge to [[_COMMUNITY_TaskReadCacheService]]
- 1 edge to [[_COMMUNITY_withTenantRls]]
- 1 edge to [[_COMMUNITY_class-validator]]

## Top bridge nodes
- [[warehouse-tasks.service.ts]] - degree 67, connects to 18 communities
- [[workflow-orchestration.service.ts]] - degree 24, connects to 7 communities
- [[workflow-bootstrap.service.ts]] - degree 30, connects to 6 communities
- [[workflow-engine.service.ts]] - degree 27, connects to 6 communities
- [[WorkflowOrchestrationService]] - degree 24, connects to 5 communities