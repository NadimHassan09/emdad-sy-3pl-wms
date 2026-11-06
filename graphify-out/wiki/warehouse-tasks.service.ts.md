# warehouse-tasks.service.ts

> 127 nodes · cohesion 0.03

## Key Concepts

- **warehouse-tasks.service.ts** (67 connections) — `backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts`
- **workflow-bootstrap.service.ts** (30 connections) — `backend/src/modules/warehouse-workflow/workflow-bootstrap.service.ts`
- **workflow-engine.service.ts** (27 connections) — `backend/src/modules/warehouse-workflow/workflow-engine.service.ts`
- **workflow-orchestration.service.ts** (24 connections) — `backend/src/modules/warehouse-workflow/workflow-orchestration.service.ts`
- **WorkflowOrchestrationService** (24 connections) — `backend/src/modules/warehouse-workflow/workflow-orchestration.service.ts`
- **WorkflowBootstrapService** (20 connections) — `backend/src/modules/warehouse-workflow/workflow-bootstrap.service.ts`
- **task-runnable.util.ts** (17 connections) — `backend/src/modules/warehouse-workflow/task-runnable.util.ts`
- **workflow.controller.ts** (15 connections) — `backend/src/modules/warehouse-workflow/workflow.controller.ts`
- **workflow-timeline.helpers.ts** (15 connections) — `backend/src/modules/warehouse-workflow/workflow-timeline.helpers.ts`
- **.createOutboundInstanceWithFirstPickTask()** (14 connections) — `backend/src/modules/warehouse-workflow/workflow-engine.service.ts`
- **workflow-active.util.ts** (13 connections) — `backend/src/modules/warehouse-workflow/workflow-active.util.ts`
- **.createInboundInstanceWithFirstReceiveTask()** (12 connections) — `backend/src/modules/warehouse-workflow/workflow-engine.service.ts`
- **oms-warehouse-guards.ts** (11 connections) — `backend/src/modules/oms/oms-warehouse-guards.ts`
- **getFrontierBlockedReason()** (11 connections) — `backend/src/modules/warehouse-workflow/task-runnable.util.ts`
- **WorkflowController** (11 connections) — `backend/src/modules/warehouse-workflow/workflow.controller.ts`
- **computeRunnableTaskIds()** (9 connections) — `backend/src/modules/warehouse-workflow/task-runnable.util.ts`
- **defaultSlaMinutesForTaskType()** (9 connections) — `backend/src/modules/warehouse-workflow/task-sla-defaults.ts`
- **.onTaskCompleted()** (9 connections) — `backend/src/modules/warehouse-workflow/workflow-orchestration.service.ts`
- **workflow-payload.contracts.ts** (9 connections) — `backend/src/modules/warehouse-workflow/workflow-payload.contracts.ts`
- **realtime-task.payload.ts** (8 connections) — `backend/src/modules/realtime/realtime-task.payload.ts`
- **.recoverWorkflowInstance()** (8 connections) — `backend/src/modules/warehouse-workflow/workflow.controller.ts`
- **.startInbound()** (8 connections) — `backend/src/modules/warehouse-workflow/workflow.controller.ts`
- **.startOutbound()** (8 connections) — `backend/src/modules/warehouse-workflow/workflow.controller.ts`
- **.enqueueDispatchTaskIfNeeded()** (8 connections) — `backend/src/modules/warehouse-workflow/workflow-orchestration.service.ts`
- **OrderNotificationTarget** (7 connections) — `backend/src/modules/notifications/notifications.service.ts`
- *... and 102 more nodes in this community*

## Relationships

- [@prisma/client](@prisma-client.md) (37 shared connections)
- [AuthPrincipal](AuthPrincipal.md) (22 shared connections)
- [WarehouseTasksService](WarehouseTasksService.md) (21 shared connections)
- [outbound.service.ts](outbound.service.ts.md) (19 shared connections)
- [task-inventory-effects.service.ts](task-inventory-effects.service.ts.md) (17 shared connections)
- [reliability-test-helpers.ts](reliability-test-helpers.ts.md) (12 shared connections)
- [app.module.ts](app.module.ts.md) (11 shared connections)
- [@nestjs/common](@nestjs-common.md) (9 shared connections)
- [CurrentUser](CurrentUser.md) (8 shared connections)
- [dashboard.service.ts](dashboard.service.ts.md) (6 shared connections)
- [NotificationsService](NotificationsService.md) (5 shared connections)
- [RealtimeService](RealtimeService.md) (4 shared connections)

## Source Files

- `backend/src/modules/notifications/notifications.service.ts`
- `backend/src/modules/oms/oms-warehouse-guards.ts`
- `backend/src/modules/oms/oms-warehouse-guards.unit.spec.ts`
- `backend/src/modules/realtime/realtime-task.payload.ts`
- `backend/src/modules/warehouse-workflow/dto/start-workflow.dto.ts`
- `backend/src/modules/warehouse-workflow/execution-state-location.util.ts`
- `backend/src/modules/warehouse-workflow/task-mutation-envelope.dto.ts`
- `backend/src/modules/warehouse-workflow/task-payload.schema.ts`
- `backend/src/modules/warehouse-workflow/task-runnable.util.ts`
- `backend/src/modules/warehouse-workflow/task-sla-defaults.ts`
- `backend/src/modules/warehouse-workflow/task-transitions.ts`
- `backend/src/modules/warehouse-workflow/warehouse-tasks.service.ts`
- `backend/src/modules/warehouse-workflow/workflow-active.util.ts`
- `backend/src/modules/warehouse-workflow/workflow-bootstrap.service.ts`
- `backend/src/modules/warehouse-workflow/workflow-engine.service.ts`
- `backend/src/modules/warehouse-workflow/workflow-orchestration.service.ts`
- `backend/src/modules/warehouse-workflow/workflow-payload.contracts.ts`
- `backend/src/modules/warehouse-workflow/workflow-recovery.service.ts`
- `backend/src/modules/warehouse-workflow/workflow-timeline.helpers.ts`
- `backend/src/modules/warehouse-workflow/workflow.controller.ts`

## Audit Trail

- EXTRACTED: 434 (95%)
- INFERRED: 25 (5%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*