---
source_file: "backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts"
type: "code"
community: "WarehouseTasksService"
location: "L953"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/WarehouseTasksService
---

# .complete()

## Connections
- [[dot-adminConfirm()_1]] - `calls` [EXTRACTED]
- [[dot-afterTaskAndStockMutation()]] - `calls` [INFERRED]
- [[dot-appendEvent()]] - `calls` [EXTRACTED]
- [[dot-applyDispatchShip()]] - `calls` [INFERRED]
- [[dot-applyPackRecord()]] - `calls` [INFERRED]
- [[dot-applyPickRecord()]] - `calls` [INFERRED]
- [[dot-applyPutaway()]] - `calls` [INFERRED]
- [[dot-applyQcLines()]] - `calls` [INFERRED]
- [[dot-applyReceivingStaging()]] - `calls` [INFERRED]
- [[dot-applyShippingDetailsTaskComplete()]] - `calls` [INFERRED]
- [[dot-assertFrontierAndSkillsTx()]] - `calls` [EXTRACTED]
- [[dot-assertFrontierOnlyTx()]] - `calls` [EXTRACTED]
- [[dot-assertTaskWorkflowTenant()]] - `calls` [EXTRACTED]
- [[dot-bumpStatus()]] - `calls` [EXTRACTED]
- [[dot-complete()_2]] - `calls` [INFERRED]
- [[dot-completePickingAdmin()]] - `calls` [INFERRED]
- [[dot-emitTaskUpdatedByTaskId()]] - `calls` [INFERRED]
- [[dot-fromPrincipal()]] - `calls` [INFERRED]
- [[dot-generateDnForDispatch()]] - `calls` [INFERRED]
- [[dot-generateGrnForReceiving()]] - `calls` [INFERRED]
- [[dot-isAdminActor()]] - `calls` [EXTRACTED]
- [[dot-loadTaskEnvelope()]] - `calls` [EXTRACTED]
- [[dot-lockOutboundOrder()]] - `calls` [EXTRACTED]
- [[dot-lockTask()]] - `calls` [EXTRACTED]
- [[dot-lockWorkflowInstance()]] - `calls` [EXTRACTED]
- [[dot-lockWorkflowPickTasks()]] - `calls` [EXTRACTED]
- [[dot-logTx()]] - `calls` [INFERRED]
- [[dot-notifyClientOrderCompleted()]] - `calls` [INFERRED]
- [[dot-onTaskCompleted()]] - `calls` [INFERRED]
- [[dot-parseExecState()]] - `calls` [EXTRACTED]
- [[dot-recalculateForCompany()]] - `calls` [INFERRED]
- [[dot-refreshWorkflowInstanceHealth()]] - `calls` [EXTRACTED]
- [[dot-resolvePickTaskForDispatchCompletion()]] - `calls` [EXTRACTED]
- [[AuthPrincipal]] - `references` [EXTRACTED]
- [[WarehouseTasksService]] - `method` [EXTRACTED]
- [[billingTriggerForWarehouseTask()]] - `calls` [EXTRACTED]
- [[outboundIdFromPackPayload()]] - `calls` [EXTRACTED]
- [[parseDispatchTaskPayloadAllowLegacy()]] - `calls` [EXTRACTED]
- [[parsePickPayload()]] - `calls` [EXTRACTED]
- [[receivingOrderId()]] - `calls` [EXTRACTED]
- [[safeParseTaskComplete()_2]] - `calls` [EXTRACTED]
- [[sourceMapFromPutawayPayload()]] - `calls` [EXTRACTED]
- [[stagingMapFromReceivingPayload()]] - `calls` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/WarehouseTasksService