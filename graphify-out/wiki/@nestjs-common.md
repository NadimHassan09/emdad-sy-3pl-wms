# @nestjs/common

> 167 nodes · cohesion 0.04

## Key Concepts

- **@nestjs/common** (333 connections) — `backend/package.json`
- **client-portal.module.ts** (116 connections) — `backend/src/modules/client-portal/client-portal.module.ts`
- **Public()** (59 connections) — `backend/src/common/auth/public.decorator.ts`
- **oms.controller.ts** (55 connections) — `backend/src/modules/oms/oms.controller.ts`
- **client-principal.types.ts** (45 connections) — `backend/src/common/auth/client-principal.types.ts`
- **outbound.controller.ts** (41 connections) — `backend/src/modules/outbound/outbound.controller.ts`
- **current-user.decorator.ts** (39 connections) — `backend/src/common/auth/current-user.decorator.ts`
- **ParseUuidLoosePipe** (36 connections) — `backend/src/common/pipes/parse-uuid-loose.pipe.ts`
- **parse-uuid-loose.pipe.ts** (35 connections) — `backend/src/common/pipes/parse-uuid-loose.pipe.ts`
- **client-oms-orders.controller.ts** (35 connections) — `backend/src/modules/client-portal/oms/client-oms-orders.controller.ts`
- **client-auth.service.ts** (33 connections) — `backend/src/modules/client-portal/auth/client-auth.service.ts`
- **inbound.controller.ts** (33 connections) — `backend/src/modules/inbound/inbound.controller.ts`
- **ref_express** (33 connections)
- **client-inbound-orders.controller.ts** (29 connections) — `backend/src/modules/client-portal/inbound/client-inbound-orders.controller.ts`
- **client-outbound-orders.controller.ts** (29 connections) — `backend/src/modules/client-portal/outbound/client-outbound-orders.controller.ts`
- **internal-admin.guard.ts** (28 connections) — `backend/src/common/auth/internal-admin.guard.ts`
- **public.decorator.ts** (28 connections) — `backend/src/common/auth/public.decorator.ts`
- **companies.controller.ts** (28 connections) — `backend/src/modules/companies/companies.controller.ts`
- **client-media.controller.ts** (27 connections) — `backend/src/modules/client-portal/media/client-media.controller.ts`
- **auth.controller.ts** (26 connections) — `backend/src/modules/auth/auth.controller.ts`
- **client-inbound-orders.service.ts** (26 connections) — `backend/src/modules/client-portal/inbound/client-inbound-orders.service.ts`
- **client-outbound-orders.service.ts** (26 connections) — `backend/src/modules/client-portal/outbound/client-outbound-orders.service.ts`
- **InternalAdminGuard** (25 connections) — `backend/src/common/auth/internal-admin.guard.ts`
- **audit-logs.controller.ts** (25 connections) — `backend/src/modules/audit-logs/audit-logs.controller.ts`
- **client-products.service.ts** (25 connections) — `backend/src/modules/client-portal/products/client-products.service.ts`
- *... and 142 more nodes in this community*

## Relationships

- [@prisma/client](@prisma-client.md) (175 shared connections)
- [ClientPrincipal](ClientPrincipal.md) (110 shared connections)
- [app.module.ts](app.module.ts.md) (109 shared connections)
- [class-validator](class-validator.md) (57 shared connections)
- [EmptyToUndefined](EmptyToUndefined.md) (44 shared connections)
- [client-oms-orders.service.ts](client-oms-orders.service.ts.md) (36 shared connections)
- [AuthPrincipal](AuthPrincipal.md) (33 shared connections)
- [oms-client-import.service.ts](oms-client-import.service.ts.md) (33 shared connections)
- [inbound-orders-csv.service.ts](inbound-orders-csv.service.ts.md) (31 shared connections)
- [CurrentUser](CurrentUser.md) (26 shared connections)
- [AuditLogService](AuditLogService.md) (24 shared connections)
- [warehouse-tasks.controller.ts](warehouse-tasks.controller.ts.md) (23 shared connections)

## Source Files

- `backend/package.json`
- `backend/src/common/auth/client-auth-principal.ts`
- `backend/src/common/auth/client-principal.types.ts`
- `backend/src/common/auth/current-user.decorator.ts`
- `backend/src/common/auth/internal-admin.guard.ts`
- `backend/src/common/auth/internal-admin.guard.unit.spec.ts`
- `backend/src/common/auth/mock-auth.middleware.ts`
- `backend/src/common/auth/public.decorator.ts`
- `backend/src/common/auth/super-admin.guard.ts`
- `backend/src/common/auth/super-admin.guard.unit.spec.ts`
- `backend/src/common/crypto/crypto.module.ts`
- `backend/src/common/pipes/parse-uuid-loose.pipe.ts`
- `backend/src/common/security/login-brute-force.service.ts`
- `backend/src/common/security/request-ip.util.ts`
- `backend/src/modules/adjustments/adjustments.controller.ts`
- `backend/src/modules/audit-logs/audit-logs.controller.ts`
- `backend/src/modules/auth/auth.controller.ts`
- `backend/src/modules/client-portal/api-credentials/api-credentials.controller.ts`
- `backend/src/modules/client-portal/auth/client-auth.controller.ts`
- `backend/src/modules/client-portal/auth/client-auth.service.ts`

## Audit Trail

- EXTRACTED: 1716 (99%)
- INFERRED: 10 (1%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*