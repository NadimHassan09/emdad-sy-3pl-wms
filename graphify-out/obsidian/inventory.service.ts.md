---
source_file: "backend/src/modules/inventory/inventory.service.ts"
type: "code"
community: "inventory.service.ts"
location: "L1"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/inventoryservicets
---

# inventory.service.ts

## Connections
- [[@nestjscommon]] - `imports_from` [EXTRACTED]
- [[@prismaclient]] - `imports_from` [EXTRACTED]
- [[AuditLogService]] - `imports` [EXTRACTED]
- [[AuthPrincipal]] - `imports` [EXTRACTED]
- [[AvailabilityResult]] - `contains` [EXTRACTED]
- [[CompanyAccessService]] - `imports` [EXTRACTED]
- [[ExpectedReturnHoldService]] - `imports` [EXTRACTED]
- [[InsufficientStockException]] - `imports` [EXTRACTED]
- [[InternalTransferDto]] - `imports` [EXTRACTED]
- [[InventoryService]] - `contains` [EXTRACTED]
- [[LEDGER_ROW_INCLUDE]] - `contains` [EXTRACTED]
- [[LedgerEntryQueryDto]] - `imports` [EXTRACTED]
- [[LedgerEntrySiblingRow]] - `imports` [EXTRACTED]
- [[LedgerGroupPageRow]] - `imports` [EXTRACTED]
- [[LedgerQueryDto]] - `imports` [EXTRACTED]
- [[LedgerRowWithRelations]] - `contains` [EXTRACTED]
- [[LocationForLabel]] - `contains` [EXTRACTED]
- [[PrismaService]] - `imports` [EXTRACTED]
- [[RealtimeService]] - `imports` [EXTRACTED]
- [[StockByProductRow]] - `imports` [EXTRACTED]
- [[StockHelpers]] - `imports` [EXTRACTED]
- [[StockQueryDto]] - `imports` [EXTRACTED]
- [[assertLocationUsableForInventoryMove()]] - `imports` [EXTRACTED]
- [[audit-log.service.ts]] - `imports_from` [EXTRACTED]
- [[buildLedgerListSqlContext()]] - `imports` [EXTRACTED]
- [[buildStockByProductSqlContext()]] - `imports` [EXTRACTED]
- [[businessGroupKey()]] - `contains` [EXTRACTED]
- [[client-products.service.ts]] - `imports_from` [EXTRACTED]
- [[client-stock.service.ts]] - `imports_from` [EXTRACTED]
- [[company-access.service.ts]] - `imports_from` [EXTRACTED]
- [[company-read-scope.ts]] - `imports_from` [EXTRACTED]
- [[current-user.types.ts]] - `imports_from` [EXTRACTED]
- [[domain-exceptions.ts]] - `imports_from` [EXTRACTED]
- [[expected-return-hold.service.ts]] - `imports_from` [EXTRACTED]
- [[internal-transfer.dto.ts]] - `imports_from` [EXTRACTED]
- [[inventory-intelligence-reports.runner.ts]] - `imports_from` [EXTRACTED]
- [[inventory-intelligence-reports.runner.unit.spec.ts]] - `imports_from` [EXTRACTED]
- [[inventory.availability.unit.spec.ts]] - `imports_from` [EXTRACTED]
- [[inventory.controller.ts]] - `imports_from` [EXTRACTED]
- [[inventory.module.ts]] - `imports_from` [EXTRACTED]
- [[isAdjustmentStockLocationType()]] - `imports` [EXTRACTED]
- [[ledger-entry-query.dto.ts]] - `imports_from` [EXTRACTED]
- [[ledger-list.query.ts]] - `imports_from` [EXTRACTED]
- [[ledger-mapper.ts]] - `imports_from` [EXTRACTED]
- [[ledgerBusinessGroupPageSql()]] - `imports` [EXTRACTED]
- [[ledgerBusinessGroupsCountSql()]] - `imports` [EXTRACTED]
- [[ledgerEntrySiblingRowsSql()]] - `imports` [EXTRACTED]
- [[ledgerSignedQuantity()]] - `imports` [EXTRACTED]
- [[ledgerSignedQuantitySql()]] - `imports` [EXTRACTED]
- [[location-operational.ts]] - `imports_from` [EXTRACTED]
- [[prisma.service.ts]] - `imports_from` [EXTRACTED]
- [[readCompanyIdFilter()]] - `imports` [EXTRACTED]
- [[readCompanyIdFilterRequired()]] - `imports` [EXTRACTED]
- [[realtime-ops.payload.ts]] - `imports_from` [EXTRACTED]
- [[realtime.service.ts]] - `imports_from` [EXTRACTED]
- [[ref_node_crypto]] - `imports_from` [EXTRACTED]
- [[reports.service.ts]] - `imports_from` [EXTRACTED]
- [[stock-by-product.query.ts]] - `imports_from` [EXTRACTED]
- [[stock-query.dto.ts]] - `imports_from` [EXTRACTED]
- [[stock.helpers.ts]] - `imports_from` [EXTRACTED]
- [[stockByProductCountSql()]] - `imports` [EXTRACTED]
- [[stockByProductPageSql()]] - `imports` [EXTRACTED]
- [[storage-location-types.ts]] - `imports_from` [EXTRACTED]
- [[tenant-rls.ts]] - `imports_from` [EXTRACTED]
- [[toBusinessMovementType()]] - `contains` [EXTRACTED]
- [[toLedgerDisplayMovement()]] - `imports` [EXTRACTED]
- [[transferPayload()]] - `imports` [EXTRACTED]
- [[withTenantRls()]] - `imports` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/inventoryservicets