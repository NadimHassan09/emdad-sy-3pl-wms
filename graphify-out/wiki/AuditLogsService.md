# AuditLogsService

> 47 nodes · cohesion 0.08

## Key Concepts

- **AuditLogsService** (28 connections) — `backend/src/modules/audit-logs/audit-logs.service.ts`
- **.export()** (12 connections) — `backend/src/modules/audit-logs/audit-logs.service.ts`
- **AuditLogsController** (11 connections) — `backend/src/modules/audit-logs/audit-logs.controller.ts`
- **.export()** (11 connections) — `backend/src/modules/audit-logs/audit-logs.controller.ts`
- **.list()** (11 connections) — `backend/src/modules/audit-logs/audit-logs.service.ts`
- **AuditLogPolicyConfig** (10 connections) — `backend/src/modules/audit-logs/audit-log-policy.config.ts`
- **.buildQueryContext()** (8 connections) — `backend/src/modules/audit-logs/audit-logs.service.ts`
- **.list()** (7 connections) — `backend/src/modules/audit-logs/audit-logs.controller.ts`
- **.retentionCutoffDate()** (6 connections) — `backend/src/modules/audit-logs/audit-log-policy.config.ts`
- **.findOne()** (6 connections) — `backend/src/modules/audit-logs/audit-logs.controller.ts`
- **.findById()** (6 connections) — `backend/src/modules/audit-logs/audit-logs.service.ts`
- **.getArchivalCandidates()** (5 connections) — `backend/src/modules/audit-logs/audit-logs.controller.ts`
- **Get** (5 connections)
- **.getArchivalCandidates()** (5 connections) — `backend/src/modules/audit-logs/audit-logs.service.ts`
- **.resolveDateRange()** (5 connections) — `backend/src/modules/audit-logs/audit-logs.service.ts`
- **.assertRowVisible()** (4 connections) — `backend/src/modules/audit-logs/audit-logs.service.ts`
- **.buildCursorClause()** (4 connections) — `backend/src/modules/audit-logs/audit-logs.service.ts`
- **.buildFilters()** (4 connections) — `backend/src/modules/audit-logs/audit-logs.service.ts`
- **.buildTenantScope()** (4 connections) — `backend/src/modules/audit-logs/audit-logs.service.ts`
- **.getPolicy()** (4 connections) — `backend/src/modules/audit-logs/audit-logs.service.ts`
- **.toDetail()** (4 connections) — `backend/src/modules/audit-logs/audit-logs.service.ts`
- **.toSummary()** (4 connections) — `backend/src/modules/audit-logs/audit-logs.service.ts`
- **.constructor()** (3 connections) — `backend/src/modules/audit-logs/audit-log-policy.config.ts`
- **.snapshot()** (3 connections) — `backend/src/modules/audit-logs/audit-log-policy.config.ts`
- **AuditLogPolicySnapshot** (3 connections) — `backend/src/modules/audit-logs/audit-log-policy.config.ts`
- *... and 22 more nodes in this community*

## Relationships

- [AuthPrincipal](AuthPrincipal.md) (12 shared connections)
- [ListAuditLogsQueryDto](ListAuditLogsQueryDto.md) (7 shared connections)
- [AuditLogService](AuditLogService.md) (6 shared connections)
- [app.module.ts](app.module.ts.md) (5 shared connections)
- [CurrentUser](CurrentUser.md) (4 shared connections)
- [@nestjs/common](@nestjs-common.md) (2 shared connections)
- [.fromPrincipal](fromPrincipal.md) (2 shared connections)
- [WarehouseTasksService](WarehouseTasksService.md) (1 shared connections)
- [.assertCompanyAccess](assertCompanyAccess.md) (1 shared connections)
- [@prisma/client](@prisma-client.md) (1 shared connections)
- [rbac-policy.ts](rbac-policy.ts.md) (1 shared connections)

## Source Files

- `backend/src/modules/audit-logs/audit-log-policy.config.ts`
- `backend/src/modules/audit-logs/audit-logs.controller.ts`
- `backend/src/modules/audit-logs/audit-logs.service.ts`

## Audit Trail

- EXTRACTED: 115 (90%)
- INFERRED: 13 (10%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*