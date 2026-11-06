# AuditLogService

> 107 nodes · cohesion 0.03

## Key Concepts

- **AuditLogService** (60 connections) — `backend/src/common/audit/audit-log.service.ts`
- **products.service.ts** (56 connections) — `backend/src/modules/products/products.service.ts`
- **audit-log.service.ts** (40 connections) — `backend/src/common/audit/audit-log.service.ts`
- **audit-logs.service.ts** (36 connections) — `backend/src/modules/audit-logs/audit-logs.service.ts`
- **audit-mutations.integration.ts** (28 connections) — `backend/src/integration-tests/audit-mutations.integration.ts`
- **products-barcode.integration.ts** (26 connections) — `backend/src/integration-tests/products-barcode.integration.ts`
- **google-oauth.service.ts** (26 connections) — `backend/src/modules/auth/google-oauth.service.ts`
- **customer-lifecycle.service.ts** (26 connections) — `backend/src/modules/companies/customer-lifecycle.service.ts`
- **warehouses.service.ts** (25 connections) — `backend/src/modules/warehouses/warehouses.service.ts`
- **products.service.unit.spec.ts** (17 connections) — `backend/src/modules/products/products.service.unit.spec.ts`
- **LoginBruteForceService** (16 connections) — `backend/src/common/security/login-brute-force.service.ts`
- **RefreshSessionService** (14 connections) — `backend/src/modules/auth/refresh-session.service.ts`
- **realtime-master-data.payload.ts** (11 connections) — `backend/src/modules/realtime/realtime-master-data.payload.ts`
- **.constructor()** (10 connections) — `backend/src/modules/returns/returns.service.ts`
- **generators/identifiers.ts** (9 connections) — `backend/src/common/generators/identifiers.ts`
- **coerceOptionalBool()** (9 connections) — `backend/src/common/utils/coerce-boolean.ts`
- **warehouses.service.unit.spec.ts** (8 connections) — `backend/src/modules/warehouses/warehouses.service.unit.spec.ts`
- **buildProductsService()** (7 connections) — `backend/src/integration-tests/products-barcode.integration.ts`
- **product-volume.util.ts** (7 connections) — `backend/src/modules/products/product-volume.util.ts`
- **billing-usage.unit.spec.ts** (6 connections) — `backend/src/modules/billing/billing-usage.unit.spec.ts`
- **.constructor()** (6 connections) — `backend/src/modules/companies/customer-lifecycle.service.ts`
- **computeProductVolumeCbm()** (6 connections) — `backend/src/modules/products/product-volume.util.ts`
- **resolveProductVolumeCbmFromDims()** (6 connections) — `backend/src/modules/products/product-volume.util.ts`
- **realtime-activity.payload.ts** (6 connections) — `backend/src/modules/realtime/realtime-activity.payload.ts`
- **redactAuditState()** (5 connections) — `backend/src/common/audit/audit-log-redaction.util.ts`
- *... and 82 more nodes in this community*

## Relationships

- [@prisma/client](@prisma-client.md) (92 shared connections)
- [@nestjs/common](@nestjs-common.md) (24 shared connections)
- [RealtimeService](RealtimeService.md) (21 shared connections)
- [ProductsService](ProductsService.md) (20 shared connections)
- [app.module.ts](app.module.ts.md) (14 shared connections)
- [testProductUpdateAuditHasBeforeAfter](testProductUpdateAuditHasBeforeAfter.md) (13 shared connections)
- [WarehousesService](WarehousesService.md) (12 shared connections)
- [AuthPrincipal](AuthPrincipal.md) (10 shared connections)
- [cycle-count.service.ts](cycle-count.service.ts.md) (9 shared connections)
- [reliability-test-helpers.ts](reliability-test-helpers.ts.md) (8 shared connections)
- [outbound.service.ts](outbound.service.ts.md) (8 shared connections)
- [AuditLogsService](AuditLogsService.md) (6 shared connections)

## Source Files

- `backend/src/common/audit/audit-log-redaction.util.ts`
- `backend/src/common/audit/audit-log.service.ts`
- `backend/src/common/generators/identifiers.ts`
- `backend/src/common/security/login-brute-force.service.ts`
- `backend/src/common/security/login-brute-force.service.unit.spec.ts`
- `backend/src/common/utils/coerce-boolean.ts`
- `backend/src/integration-tests/audit-mutations.integration.ts`
- `backend/src/integration-tests/products-barcode.integration.ts`
- `backend/src/modules/audit-logs/audit-logs.service.ts`
- `backend/src/modules/auth/google-oauth.service.ts`
- `backend/src/modules/auth/refresh-session.service.ts`
- `backend/src/modules/billing/billing-audit.service.ts`
- `backend/src/modules/billing/billing-invoice-calculation.service.ts`
- `backend/src/modules/billing/billing-usage.unit.spec.ts`
- `backend/src/modules/companies/customer-lifecycle.service.ts`
- `backend/src/modules/products/product-audit.util.ts`
- `backend/src/modules/products/product-volume.util.ts`
- `backend/src/modules/products/product-volume.util.unit.spec.ts`
- `backend/src/modules/products/products.service.ts`
- `backend/src/modules/products/products.service.unit.spec.ts`

## Audit Trail

- EXTRACTED: 471 (98%)
- INFERRED: 11 (2%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*