# warehouse-tasks.controller.ts

> 37 nodes · cohesion 0.09

## Key Concepts

- **warehouse-tasks.controller.ts** (34 connections) — `backend/src/modules/warehouse-workflow/warehouse-tasks.controller.ts`
- **cycle-count-execution.controller.ts** (23 connections) — `backend/src/modules/cycle-count/cycle-count-execution.controller.ts`
- **shipping-fee.controller.ts** (22 connections) — `backend/src/modules/shipping/shipping-fee.controller.ts`
- **roles.guard.ts** (21 connections) — `backend/src/common/auth/roles.guard.ts`
- **reports.controller.ts** (21 connections) — `backend/src/modules/reports/reports.controller.ts`
- **auth-groups.ts** (14 connections) — `backend/src/common/auth/auth-groups.ts`
- **AuthGroup** (13 connections) — `backend/src/common/auth/auth-groups.ts`
- **roles.decorator.ts** (13 connections) — `backend/src/common/auth/roles.decorator.ts`
- **RolesGuard** (12 connections) — `backend/src/common/auth/roles.guard.ts`
- **workflow-execution-gate.guard.ts** (8 connections) — `backend/src/modules/warehouse-workflow/workflow-execution-gate.guard.ts`
- **PatchTaskProgressDto** (7 connections) — `backend/src/modules/warehouse-workflow/dto/patch-task-progress.dto.ts`
- **SkipTaskDto** (6 connections) — `backend/src/modules/warehouse-workflow/dto/skip-task.dto.ts`
- **WorkflowExecutionGateGuard** (6 connections) — `backend/src/modules/warehouse-workflow/workflow-execution-gate.guard.ts`
- **RetryTaskDto** (5 connections) — `backend/src/modules/warehouse-workflow/dto/retry-task.dto.ts`
- **PatchTaskPlanDto** (4 connections) — `backend/src/modules/warehouse-workflow/dto/patch-task-plan.dto.ts`
- **patch-task-plan.dto.ts** (3 connections) — `backend/src/modules/warehouse-workflow/dto/patch-task-plan.dto.ts`
- **patch-task-progress.dto.ts** (3 connections) — `backend/src/modules/warehouse-workflow/dto/patch-task-progress.dto.ts`
- **retry-task.dto.ts** (3 connections) — `backend/src/modules/warehouse-workflow/dto/retry-task.dto.ts`
- **skip-task.dto.ts** (3 connections) — `backend/src/modules/warehouse-workflow/dto/skip-task.dto.ts`
- **ROLES_KEY** (2 connections) — `backend/src/common/auth/roles.decorator.ts`
- **.canActivate()** (2 connections) — `backend/src/modules/warehouse-workflow/workflow-execution-gate.guard.ts`
- **.constructor()** (2 connections) — `backend/src/modules/warehouse-workflow/workflow-execution-gate.guard.ts`
- **ADMIN** (1 connections) — `backend/src/common/auth/auth-groups.ts`
- **OPERATOR** (1 connections) — `backend/src/common/auth/auth-groups.ts`
- **.constructor()** (1 connections) — `backend/src/common/auth/roles.guard.ts`
- *... and 12 more nodes in this community*

## Relationships

- [@nestjs/common](@nestjs-common.md) (23 shared connections)
- [class-validator](class-validator.md) (16 shared connections)
- [WarehouseTasksService](WarehouseTasksService.md) (15 shared connections)
- [@prisma/client](@prisma-client.md) (11 shared connections)
- [app.module.ts](app.module.ts.md) (9 shared connections)
- [shipping-fee.service.ts](shipping-fee.service.ts.md) (8 shared connections)
- [AuthPrincipal](AuthPrincipal.md) (6 shared connections)
- [RunReportQueryDto](RunReportQueryDto.md) (6 shared connections)
- [shipping.controller.ts](shipping.controller.ts.md) (5 shared connections)
- [CycleCountExecutionService](CycleCountExecutionService.md) (4 shared connections)
- [CurrentUser](CurrentUser.md) (4 shared connections)
- [userRoleToAuthGroup](userRoleToAuthGroup.md) (3 shared connections)

## Source Files

- `backend/src/common/auth/auth-groups.ts`
- `backend/src/common/auth/roles.decorator.ts`
- `backend/src/common/auth/roles.guard.ts`
- `backend/src/modules/cycle-count/cycle-count-execution.controller.ts`
- `backend/src/modules/reports/reports.controller.ts`
- `backend/src/modules/shipping/shipping-fee.controller.ts`
- `backend/src/modules/warehouse-workflow/dto/patch-task-plan.dto.ts`
- `backend/src/modules/warehouse-workflow/dto/patch-task-progress.dto.ts`
- `backend/src/modules/warehouse-workflow/dto/retry-task.dto.ts`
- `backend/src/modules/warehouse-workflow/dto/skip-task.dto.ts`
- `backend/src/modules/warehouse-workflow/warehouse-tasks.controller.ts`
- `backend/src/modules/warehouse-workflow/workflow-execution-gate.guard.ts`

## Audit Trail

- EXTRACTED: 180 (99%)
- INFERRED: 1 (1%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*