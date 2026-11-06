# inventory.service.ts

> 55 nodes · cohesion 0.08

## Key Concepts

- **inventory.service.ts** (68 connections) — `backend/src/modules/inventory/inventory.service.ts`
- **InventoryService** (30 connections) — `backend/src/modules/inventory/inventory.service.ts`
- **readCompanyIdFilterRequired()** (28 connections) — `backend/src/common/auth/company-read-scope.ts`
- **ledger-list.query.ts** (27 connections) — `backend/src/modules/inventory/ledger-list.query.ts`
- **stock-by-product.query.ts** (22 connections) — `backend/src/modules/inventory/stock-by-product.query.ts`
- **.internalTransfer()** (17 connections) — `backend/src/modules/inventory/inventory.service.ts`
- **.ledgerEntry()** (11 connections) — `backend/src/modules/inventory/inventory.service.ts`
- **.ledger()** (10 connections) — `backend/src/modules/inventory/inventory.service.ts`
- **.stockByProductSummary()** (9 connections) — `backend/src/modules/inventory/inventory.service.ts`
- **ledger-mapper.ts** (8 connections) — `backend/src/modules/inventory/ledger-mapper.ts`
- **.requireReadTenantScope()** (7 connections) — `backend/src/common/company-access/company-access.service.ts`
- **.balanceHistory()** (6 connections) — `backend/src/modules/inventory/inventory.service.ts`
- **.resolveCurrentStockWhere()** (6 connections) — `backend/src/modules/inventory/inventory.service.ts`
- **ledgerBusinessGroupKeySql()** (6 connections) — `backend/src/modules/inventory/ledger-list.query.ts`
- **ledgerSignedQuantitySql()** (6 connections) — `backend/src/modules/inventory/ledger-list.query.ts`
- **stockByProductPageSql()** (6 connections) — `backend/src/modules/inventory/stock-by-product.query.ts`
- **.constructor()** (5 connections) — `backend/src/modules/client-portal/products/client-products.service.ts`
- **buildLedgerListSqlContext()** (5 connections) — `backend/src/modules/inventory/ledger-list.query.ts`
- **buildStockByProductSqlContext()** (5 connections) — `backend/src/modules/inventory/stock-by-product.query.ts`
- **.constructor()** (5 connections) — `backend/src/modules/reports/inventory-intelligence-reports.runner.ts`
- **.formatLedgerRow()** (4 connections) — `backend/src/modules/inventory/inventory.service.ts`
- **.mapLedgerGroupPageRow()** (4 connections) — `backend/src/modules/inventory/inventory.service.ts`
- **toBusinessMovementType()** (4 connections) — `backend/src/modules/inventory/inventory.service.ts`
- **LEDGER_GROUP_PAGE_CTE()** (4 connections) — `backend/src/modules/inventory/ledger-list.query.ts`
- **ledgerBusinessGroupPageSql()** (4 connections) — `backend/src/modules/inventory/ledger-list.query.ts`
- *... and 30 more nodes in this community*

## Relationships

- [@prisma/client](@prisma-client.md) (42 shared connections)
- [RunReportQueryDto](RunReportQueryDto.md) (11 shared connections)
- [AuthPrincipal](AuthPrincipal.md) (10 shared connections)
- [EmptyToUndefined](EmptyToUndefined.md) (10 shared connections)
- [class-validator](class-validator.md) (8 shared connections)
- [returns.service.ts](returns.service.ts.md) (7 shared connections)
- [CurrentUser](CurrentUser.md) (6 shared connections)
- [withTenantRls](withTenantRls.md) (6 shared connections)
- [cycle-count.service.ts](cycle-count.service.ts.md) (5 shared connections)
- [task-inventory-effects.service.ts](task-inventory-effects.service.ts.md) (5 shared connections)
- [RealtimeService](RealtimeService.md) (5 shared connections)
- [@nestjs/common](@nestjs-common.md) (5 shared connections)

## Source Files

- `backend/src/common/auth/company-read-scope.ts`
- `backend/src/common/company-access/company-access.service.ts`
- `backend/src/modules/client-portal/products/client-products.service.ts`
- `backend/src/modules/client-portal/stock/client-stock.service.ts`
- `backend/src/modules/inventory/inventory.availability.unit.spec.ts`
- `backend/src/modules/inventory/inventory.controller.ts`
- `backend/src/modules/inventory/inventory.service.ts`
- `backend/src/modules/inventory/ledger-list.query.ts`
- `backend/src/modules/inventory/ledger-mapper.ts`
- `backend/src/modules/inventory/stock-by-product.query.ts`
- `backend/src/modules/realtime/realtime-ops.payload.ts`
- `backend/src/modules/reports/inventory-intelligence-reports.runner.ts`

## Audit Trail

- EXTRACTED: 243 (92%)
- INFERRED: 20 (8%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*