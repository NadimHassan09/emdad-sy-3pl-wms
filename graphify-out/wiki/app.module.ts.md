# app.module.ts

> 151 nodes · cohesion 0.03

## Key Concepts

- **app.module.ts** (86 connections) — `backend/src/app.module.ts`
- **oms.module.ts** (56 connections) — `backend/src/modules/oms/oms.module.ts`
- **warehouse-workflow.module.ts** (54 connections) — `backend/src/modules/warehouse-workflow/warehouse-workflow.module.ts`
- **@nestjs/config** (46 connections) — `backend/package.json`
- **auth.module.ts** (36 connections) — `backend/src/modules/auth/auth.module.ts`
- **reports.module.ts** (33 connections) — `backend/src/modules/reports/reports.module.ts`
- **realtime.module.ts** (31 connections) — `backend/src/modules/realtime/realtime.module.ts`
- **cycle-count.module.ts** (27 connections) — `backend/src/modules/cycle-count/cycle-count.module.ts`
- **outbound.module.ts** (27 connections) — `backend/src/modules/outbound/outbound.module.ts`
- **inventory.module.ts** (26 connections) — `backend/src/modules/inventory/inventory.module.ts`
- **audit.module.ts** (22 connections) — `backend/src/common/audit/audit.module.ts`
- **inbound.module.ts** (21 connections) — `backend/src/modules/inbound/inbound.module.ts`
- **returns.module.ts** (20 connections) — `backend/src/modules/returns/returns.module.ts`
- **oms-returns.module.ts** (19 connections) — `backend/src/modules/oms-returns/oms-returns.module.ts`
- **AuditModule** (18 connections) — `backend/src/common/audit/audit.module.ts`
- **companies.module.ts** (18 connections) — `backend/src/modules/companies/companies.module.ts`
- **prisma.module.ts** (17 connections) — `backend/src/common/prisma/prisma.module.ts`
- **PrismaModule** (16 connections) — `backend/src/common/prisma/prisma.module.ts`
- **realtime-version.controller.ts** (15 connections) — `backend/src/modules/realtime/realtime-version.controller.ts`
- **redis.module.ts** (14 connections) — `backend/src/common/redis/redis.module.ts`
- **cod.module.ts** (14 connections) — `backend/src/modules/cod/cod.module.ts`
- **dashboard.module.ts** (14 connections) — `backend/src/modules/dashboard/dashboard.module.ts`
- **products.module.ts** (14 connections) — `backend/src/modules/products/products.module.ts`
- **company-access.module.ts** (13 connections) — `backend/src/common/company-access/company-access.module.ts`
- **audit-logs.module.ts** (13 connections) — `backend/src/modules/audit-logs/audit-logs.module.ts`
- *... and 126 more nodes in this community*

## Relationships

- [@nestjs/common](@nestjs-common.md) (109 shared connections)
- [@prisma/client](@prisma-client.md) (61 shared connections)
- [shipping.module.ts](shipping.module.ts.md) (19 shared connections)
- [RealtimeService](RealtimeService.md) (19 shared connections)
- [AuditLogService](AuditLogService.md) (14 shared connections)
- [observability.service.ts](observability.service.ts.md) (13 shared connections)
- [task-inventory-effects.service.ts](task-inventory-effects.service.ts.md) (12 shared connections)
- [grn-pdf.service.ts](grn-pdf.service.ts.md) (11 shared connections)
- [warehouse-tasks.service.ts](warehouse-tasks.service.ts.md) (11 shared connections)
- [cycle-count.service.ts](cycle-count.service.ts.md) (10 shared connections)
- [RunReportQueryDto](RunReportQueryDto.md) (10 shared connections)
- [warehouse-tasks.controller.ts](warehouse-tasks.controller.ts.md) (9 shared connections)

## Source Files

- `backend/package.json`
- `backend/src/app.module.ts`
- `backend/src/common/audit/audit.module.ts`
- `backend/src/common/auth/public.decorator.ts`
- `backend/src/common/company-access/company-access.module.ts`
- `backend/src/common/cron/cron-leader.module.ts`
- `backend/src/common/cron/cron-leader.service.unit.spec.ts`
- `backend/src/common/crypto/crypto.module.ts`
- `backend/src/common/prisma/prisma.module.ts`
- `backend/src/common/redis/redis-io.adapter.ts`
- `backend/src/common/redis/redis.module.ts`
- `backend/src/common/redis/redis.service.ts`
- `backend/src/common/redis/task-read-cache.service.ts`
- `backend/src/common/security/security.module.ts`
- `backend/src/modules/adjustments/adjustments.module.ts`
- `backend/src/modules/audit-logs/audit-log-policy.config.ts`
- `backend/src/modules/audit-logs/audit-logs.module.ts`
- `backend/src/modules/auth/auth.module.ts`
- `backend/src/modules/auth/guards/jwt-auth.guard.ts`
- `backend/src/modules/billing/billing.module.ts`

## Audit Trail

- EXTRACTED: 823 (100%)
- INFERRED: 1 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*