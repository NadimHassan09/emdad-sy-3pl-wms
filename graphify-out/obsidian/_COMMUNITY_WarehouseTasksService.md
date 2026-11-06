---
type: community
cohesion: 0.08
members: 97
---

# WarehouseTasksService

**Cohesion:** 0.08 - loosely connected
**Members:** 97 nodes

## Members
- [[dot-adminConfirm()]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.controller.ts
- [[dot-adminQuietStartAndCompletePick()]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts
- [[dot-afterTaskAndStockMutation()]] - code - backend/src/common/redis/cache-invalidation.service.ts
- [[dot-afterTaskMutation()]] - code - backend/src/common/redis/cache-invalidation.service.ts
- [[dot-appendEvent()]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts
- [[dot-applySkillRunnability()]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts
- [[dot-assertExclusiveActivePickInWorkflow()]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts
- [[dot-assertFrontierAndSkillsTx()]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts
- [[dot-assertFrontierOnlyTx()]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts
- [[dot-assertOperatorAssignedToTask()]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts
- [[dot-assertTaskWorkflowTenant()]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts
- [[dot-assign()]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.controller.ts
- [[dot-assign()_1]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts
- [[dot-buildListWhere()_2]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts
- [[dot-buildPickCompleteBodyFromReservations()]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts
- [[dot-bumpStatus()]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts
- [[dot-cancel()_4]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.controller.ts
- [[dot-cancel()_5]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts
- [[dot-complete()_2]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.controller.ts
- [[dot-complete()_3]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts
- [[dot-constructor()_150]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.controller.ts
- [[dot-detail()]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.controller.ts
- [[dot-emitTaskUpdatedByTaskId()]] - code - backend/src/modules/realtime/realtime.service.ts
- [[dot-ensureOutboundFollowupTasksAfterPicks()]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts
- [[dot-ensurePickingFollowups()]] - code - backend/src/modules/outbound/outbound.service.ts
- [[dot-ensureRunnableForExecutionGate()]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts
- [[dot-ensureWorker()]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts
- [[dot-fail()]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.controller.ts
- [[dot-fail()_1]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts
- [[dot-fetchTaskAuthorized()]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts
- [[dot-getById()]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts
- [[dot-getPathOrder()]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts
- [[dot-isAdminActor()]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts
- [[dot-leaseAcquire()]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.controller.ts
- [[dot-leaseAcquire()_1]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts
- [[dot-leaseRelease()]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.controller.ts
- [[dot-leaseRelease()_1]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts
- [[dot-list()_28]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.controller.ts
- [[dot-list()_29]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts
- [[dot-listTaskSelect()]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts
- [[dot-loadTaskEnvelope()]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts
- [[dot-lockOutboundOrder()]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts
- [[dot-lockTask()]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts
- [[dot-lockWorkflowInstance()]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts
- [[dot-lockWorkflowPickTasks()]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts
- [[dot-logTx()]] - code - backend/src/common/audit/audit-log.service.ts
- [[dot-mergePlanPatch()]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts
- [[dot-parseExecState()]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts
- [[dot-patchPlan()]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.controller.ts
- [[dot-patchPlan()_1]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts
- [[dot-patchProgress()]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.controller.ts
- [[dot-patchProgress()_1]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts
- [[dot-pathOrder()]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.controller.ts
- [[dot-refreshWorkflowInstanceHealth()]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts
- [[dot-rejectNotRunnable()]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts
- [[dot-releaseOutboundPickReservationsInWorkflow()]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts
- [[dot-releaseReservationsOnTaskCancel()]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts
- [[dot-releaseTaskHeldReservations()]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts
- [[dot-reopen()]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.controller.ts
- [[dot-reopen()_1]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts
- [[dot-resolve()]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.controller.ts
- [[dot-resolveBlocked()]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts
- [[dot-resolvePickTaskForDispatchCompletion()]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts
- [[dot-resolveProductIdFromTask()]] - code - backend/src/modules/realtime/realtime.service.ts
- [[dot-retry()_1]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.controller.ts
- [[dot-retry()_2]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts
- [[dot-skip()]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.controller.ts
- [[dot-skipTask()]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts
- [[dot-start()]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.controller.ts
- [[dot-start()_1]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts
- [[dot-unassign()]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.controller.ts
- [[dot-unassign()_1]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts
- [[dot-withRunnableFlags()]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts
- [[dot-workerIdForUser()]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts
- [[dot-workerMeetsRequiredSkills()]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts
- [[dot-workerMeetsRequiredSkillsTx()]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts
- [[Body_16]] - code
- [[Controller_28]] - code
- [[Get_24]] - code
- [[Injectable_93]] - code
- [[Param_18]] - code
- [[Post_18]] - code
- [[Put_3]] - code
- [[Query_22]] - code
- [[Roles()]] - code - backend/src/common/auth/roles.decorator.ts
- [[UseGuards_19]] - code
- [[WarehouseTasksController]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.controller.ts
- [[WarehouseTasksService]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts
- [[canTransitionTask()]] - code - backend/src/modules/warehouse-workflow/task-transitions.ts
- [[isRecord()_6]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts
- [[outboundIdFromPackPayload()]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts
- [[parseDispatchTaskPayloadAllowLegacy()]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts
- [[parseIncludeRunnability()]] - code - backend/src/modules/warehouse-workflow/dto/list-tasks-query.dto.ts
- [[parsePickPayload()]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts
- [[receivingOrderId()]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts
- [[sourceMapFromPutawayPayload()]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts
- [[stagingMapFromReceivingPayload()]] - code - backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/WarehouseTasksService
SORT file.name ASC
```

## Connections to other communities
- 46 edges to [[_COMMUNITY_AuthPrincipal]]
- 21 edges to [[_COMMUNITY_warehouse-tasks.service.ts]]
- 19 edges to [[_COMMUNITY_CurrentUser]]
- 17 edges to [[_COMMUNITY_task-inventory-effects.service.ts]]
- 16 edges to [[_COMMUNITY_dot-fromPrincipal]]
- 15 edges to [[_COMMUNITY_warehouse-tasks.controller.ts]]
- 4 edges to [[_COMMUNITY_RealtimeService]]
- 4 edges to [[_COMMUNITY_CacheInvalidationService]]
- 3 edges to [[_COMMUNITY_CycleCountService]]
- 2 edges to [[_COMMUNITY_reliability-test-helpers.ts]]
- 2 edges to [[_COMMUNITY_@prismaclient]]
- 2 edges to [[_COMMUNITY_outbound.service.ts]]
- 2 edges to [[_COMMUNITY_app.module.ts]]
- 2 edges to [[_COMMUNITY_NotificationsService]]
- 2 edges to [[_COMMUNITY_AuditLogService]]
- 2 edges to [[_COMMUNITY_ResolveTaskDto]]
- 2 edges to [[_COMMUNITY_inventory.service.ts]]
- 2 edges to [[_COMMUNITY_returns.service.ts]]
- 2 edges to [[_COMMUNITY_class-validator]]
- 2 edges to [[_COMMUNITY_BillingInvoiceCalculationService]]
- 2 edges to [[_COMMUNITY_grn-pdf.service.ts]]
- 1 edge to [[_COMMUNITY_ShippingController]]
- 1 edge to [[_COMMUNITY_withTenantRls]]
- 1 edge to [[_COMMUNITY_AuditLogsService]]
- 1 edge to [[_COMMUNITY_CycleCountExecutionService]]
- 1 edge to [[_COMMUNITY_shipping-fee.service.ts]]
- 1 edge to [[_COMMUNITY_RunReportQueryDto]]
- 1 edge to [[_COMMUNITY_ListTasksQueryDto]]
- 1 edge to [[_COMMUNITY_LeaseTaskDto]]
- 1 edge to [[_COMMUNITY_backendsrcvendorwms-task-executionregistry.ts]]
- 1 edge to [[_COMMUNITY_testProductUpdateAuditHasBeforeAfter]]
- 1 edge to [[_COMMUNITY_TaskReadCacheService]]
- 1 edge to [[_COMMUNITY_@nestjscommon]]
- 1 edge to [[_COMMUNITY_shipping.controller.ts]]
- 1 edge to [[_COMMUNITY_dot-assertCompanyAccess]]

## Top bridge nodes
- [[Roles()]] - degree 23, connects to 10 communities
- [[WarehouseTasksService]] - degree 68, connects to 9 communities
- [[dot-complete()_3]] - degree 43, connects to 8 communities
- [[dot-logTx()]] - degree 18, connects to 7 communities
- [[dot-adminQuietStartAndCompletePick()]] - degree 19, connects to 4 communities