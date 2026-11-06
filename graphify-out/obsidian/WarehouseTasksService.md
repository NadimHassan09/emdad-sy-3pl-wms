---
source_file: "backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts"
type: "code"
community: "WarehouseTasksService"
location: "L59"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/WarehouseTasksService
---

# WarehouseTasksService

## Connections
- [[dot-adminConfirm()_1]] - `method` [EXTRACTED]
- [[dot-adminQuietStartAndCompletePick()]] - `method` [EXTRACTED]
- [[dot-appendEvent()]] - `method` [EXTRACTED]
- [[dot-applySkillRunnability()]] - `method` [EXTRACTED]
- [[dot-assertExclusiveActivePickInWorkflow()]] - `method` [EXTRACTED]
- [[dot-assertFrontierAndSkillsTx()]] - `method` [EXTRACTED]
- [[dot-assertFrontierOnlyTx()]] - `method` [EXTRACTED]
- [[dot-assertOperatorAssignedToTask()]] - `method` [EXTRACTED]
- [[dot-assertTaskWorkflowTenant()]] - `method` [EXTRACTED]
- [[dot-assign()_1]] - `method` [EXTRACTED]
- [[dot-buildListWhere()_2]] - `method` [EXTRACTED]
- [[dot-buildPickCompleteBodyFromReservations()]] - `method` [EXTRACTED]
- [[dot-bumpStatus()]] - `method` [EXTRACTED]
- [[dot-cancel()_5]] - `method` [EXTRACTED]
- [[dot-complete()_3]] - `method` [EXTRACTED]
- [[dot-constructor()_139]] - `references` [EXTRACTED]
- [[dot-constructor()_145]] - `references` [EXTRACTED]
- [[dot-constructor()_150]] - `references` [EXTRACTED]
- [[dot-constructor()_11]] - `references` [EXTRACTED]
- [[dot-constructor()_198]] - `method` [EXTRACTED]
- [[dot-ensureOutboundFollowupTasksAfterPicks()]] - `method` [EXTRACTED]
- [[dot-ensureRunnableForExecutionGate()]] - `method` [EXTRACTED]
- [[dot-ensureWorker()]] - `method` [EXTRACTED]
- [[dot-fail()_1]] - `method` [EXTRACTED]
- [[dot-fetchTaskAuthorized()]] - `method` [EXTRACTED]
- [[dot-getById()]] - `method` [EXTRACTED]
- [[dot-getPathOrder()]] - `method` [EXTRACTED]
- [[dot-isAdminActor()]] - `method` [EXTRACTED]
- [[dot-leaseAcquire()_1]] - `method` [EXTRACTED]
- [[dot-leaseRelease()_1]] - `method` [EXTRACTED]
- [[dot-list()_29]] - `method` [EXTRACTED]
- [[dot-listTaskSelect()]] - `method` [EXTRACTED]
- [[dot-loadTaskEnvelope()]] - `method` [EXTRACTED]
- [[dot-lockOutboundOrder()]] - `method` [EXTRACTED]
- [[dot-lockTask()]] - `method` [EXTRACTED]
- [[dot-lockWorkflowInstance()]] - `method` [EXTRACTED]
- [[dot-lockWorkflowPickTasks()]] - `method` [EXTRACTED]
- [[dot-mergePlanPatch()]] - `method` [EXTRACTED]
- [[dot-parseExecState()]] - `method` [EXTRACTED]
- [[dot-patchPlan()_1]] - `method` [EXTRACTED]
- [[dot-patchProgress()_1]] - `method` [EXTRACTED]
- [[dot-refreshWorkflowInstanceHealth()]] - `method` [EXTRACTED]
- [[dot-rejectNotRunnable()]] - `method` [EXTRACTED]
- [[dot-releaseOutboundPickReservationsInWorkflow()]] - `method` [EXTRACTED]
- [[dot-releaseReservationsOnTaskCancel()]] - `method` [EXTRACTED]
- [[dot-releaseTaskHeldReservations()]] - `method` [EXTRACTED]
- [[dot-reopen()_1]] - `method` [EXTRACTED]
- [[dot-resolveBlocked()]] - `method` [EXTRACTED]
- [[dot-resolvePickTaskForDispatchCompletion()]] - `method` [EXTRACTED]
- [[dot-retry()_2]] - `method` [EXTRACTED]
- [[dot-skipTask()]] - `method` [EXTRACTED]
- [[dot-start()_1]] - `method` [EXTRACTED]
- [[dot-unassign()_1]] - `method` [EXTRACTED]
- [[dot-withRunnableFlags()]] - `method` [EXTRACTED]
- [[dot-workerIdForUser()]] - `method` [EXTRACTED]
- [[dot-workerMeetsRequiredSkills()]] - `method` [EXTRACTED]
- [[dot-workerMeetsRequiredSkillsTx()]] - `method` [EXTRACTED]
- [[Injectable_93]] - `references` [EXTRACTED]
- [[buildService()_7]] - `calls` [EXTRACTED]
- [[createServiceDeps()]] - `calls` [EXTRACTED]
- [[inbound.service.ts]] - `imports` [EXTRACTED]
- [[outbound.service.ts]] - `imports` [EXTRACTED]
- [[reliability-test-helpers.ts]] - `imports` [EXTRACTED]
- [[warehouse-tasks-list.service.unit.spec.ts]] - `imports` [EXTRACTED]
- [[warehouse-tasks.controller.ts]] - `imports` [EXTRACTED]
- [[warehouse-tasks.service.ts]] - `contains` [EXTRACTED]
- [[warehouse-workflow.module.ts]] - `imports` [EXTRACTED]
- [[workflow-execution-gate.guard.ts]] - `imports` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/WarehouseTasksService