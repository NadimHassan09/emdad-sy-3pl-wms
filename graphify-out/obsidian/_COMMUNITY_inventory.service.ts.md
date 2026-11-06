---
type: community
cohesion: 0.08
members: 55
---

# inventory.service.ts

**Cohesion:** 0.08 - loosely connected
**Members:** 55 nodes

## Members
- [[dot-appendInboundLedgerStockFilter()]] - code - backend/src/modules/inventory/inventory.service.ts
- [[dot-balanceHistory()_1]] - code - backend/src/modules/inventory/inventory.service.ts
- [[dot-buildLedgerLocationMap()]] - code - backend/src/modules/inventory/inventory.service.ts
- [[dot-constructor()_210]] - code - backend/src/modules/client-portal/products/client-products.service.ts
- [[dot-constructor()_211]] - code - backend/src/modules/client-portal/stock/client-stock.service.ts
- [[dot-constructor()_212]] - code - backend/src/modules/inventory/inventory.controller.ts
- [[dot-constructor()_213]] - code - backend/src/modules/reports/inventory-intelligence-reports.runner.ts
- [[dot-formatLedgerRow()]] - code - backend/src/modules/inventory/inventory.service.ts
- [[dot-internalTransfer()_1]] - code - backend/src/modules/inventory/inventory.service.ts
- [[dot-ledger()_1]] - code - backend/src/modules/inventory/inventory.service.ts
- [[dot-ledgerEntry()_1]] - code - backend/src/modules/inventory/inventory.service.ts
- [[dot-mapLedgerEntrySiblingRow()]] - code - backend/src/modules/inventory/inventory.service.ts
- [[dot-mapLedgerGroupPageRow()]] - code - backend/src/modules/inventory/inventory.service.ts
- [[dot-requireReadTenantScope()]] - code - backend/src/common/company-access/company-access.service.ts
- [[dot-resolveCurrentStockWhere()]] - code - backend/src/modules/inventory/inventory.service.ts
- [[dot-stockByProductSummary()]] - code - backend/src/modules/inventory/inventory.service.ts
- [[AvailabilityResult]] - code - backend/src/modules/inventory/inventory.service.ts
- [[INTERNAL_LEDGER_MOVEMENTS]] - code - backend/src/modules/inventory/ledger-mapper.ts
- [[Injectable_150]] - code
- [[InventoryService]] - code - backend/src/modules/inventory/inventory.service.ts
- [[LEDGER_GROUP_PAGE_CTE()]] - code - backend/src/modules/inventory/ledger-list.query.ts
- [[LEDGER_ROW_INCLUDE]] - code - backend/src/modules/inventory/inventory.service.ts
- [[LedgerDisplayMovement]] - code - backend/src/modules/inventory/ledger-mapper.ts
- [[LedgerEntrySiblingRow]] - code - backend/src/modules/inventory/ledger-list.query.ts
- [[LedgerGroupPageRow]] - code - backend/src/modules/inventory/ledger-list.query.ts
- [[LedgerListSqlContext]] - code - backend/src/modules/inventory/ledger-list.query.ts
- [[LedgerRowWithRelations]] - code - backend/src/modules/inventory/inventory.service.ts
- [[LocationForLabel]] - code - backend/src/modules/inventory/inventory.service.ts
- [[PRIMARY_LEDGER_MOVEMENTS]] - code - backend/src/modules/inventory/ledger-mapper.ts
- [[StockByProductRow]] - code - backend/src/modules/inventory/stock-by-product.query.ts
- [[StockByProductSqlContext]] - code - backend/src/modules/inventory/stock-by-product.query.ts
- [[build()_1]] - code - backend/src/modules/inventory/inventory.availability.unit.spec.ts
- [[buildLedgerListSqlContext()]] - code - backend/src/modules/inventory/ledger-list.query.ts
- [[buildStockByProductSqlContext()]] - code - backend/src/modules/inventory/stock-by-product.query.ts
- [[businessGroupKey()]] - code - backend/src/modules/inventory/inventory.service.ts
- [[dec()_4]] - code - backend/src/modules/inventory/inventory.availability.unit.spec.ts
- [[expandMovementFilter()]] - code - backend/src/modules/inventory/ledger-list.query.ts
- [[inventory.service.ts]] - code - backend/src/modules/inventory/inventory.service.ts
- [[lastMovementWarehouseCond()]] - code - backend/src/modules/inventory/stock-by-product.query.ts
- [[ledger-list.query.ts]] - code - backend/src/modules/inventory/ledger-list.query.ts
- [[ledger-mapper.ts]] - code - backend/src/modules/inventory/ledger-mapper.ts
- [[ledgerBusinessGroupKeySql()]] - code - backend/src/modules/inventory/ledger-list.query.ts
- [[ledgerBusinessGroupPageSql()]] - code - backend/src/modules/inventory/ledger-list.query.ts
- [[ledgerBusinessGroupsCountSql()]] - code - backend/src/modules/inventory/ledger-list.query.ts
- [[ledgerEntrySiblingRowsSql()]] - code - backend/src/modules/inventory/ledger-list.query.ts
- [[ledgerSignedQuantity()]] - code - backend/src/modules/inventory/ledger-mapper.ts
- [[ledgerSignedQuantitySql()]] - code - backend/src/modules/inventory/ledger-list.query.ts
- [[readCompanyIdFilterRequired()]] - code - backend/src/common/auth/company-read-scope.ts
- [[resolveInboundLedgerSliceSql()]] - code - backend/src/modules/inventory/stock-by-product.query.ts
- [[stock-by-product.query.ts]] - code - backend/src/modules/inventory/stock-by-product.query.ts
- [[stockByProductCountSql()]] - code - backend/src/modules/inventory/stock-by-product.query.ts
- [[stockByProductPageSql()]] - code - backend/src/modules/inventory/stock-by-product.query.ts
- [[toBusinessMovementType()]] - code - backend/src/modules/inventory/inventory.service.ts
- [[toLedgerDisplayMovement()]] - code - backend/src/modules/inventory/ledger-mapper.ts
- [[transferPayload()]] - code - backend/src/modules/realtime/realtime-ops.payload.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/inventoryservicets
SORT file.name ASC
```

## Connections to other communities
- 42 edges to [[_COMMUNITY_@prismaclient]]
- 11 edges to [[_COMMUNITY_RunReportQueryDto]]
- 10 edges to [[_COMMUNITY_EmptyToUndefined]]
- 10 edges to [[_COMMUNITY_AuthPrincipal]]
- 8 edges to [[_COMMUNITY_class-validator]]
- 7 edges to [[_COMMUNITY_returns.service.ts]]
- 6 edges to [[_COMMUNITY_withTenantRls]]
- 6 edges to [[_COMMUNITY_CurrentUser]]
- 5 edges to [[_COMMUNITY_@nestjscommon]]
- 5 edges to [[_COMMUNITY_task-inventory-effects.service.ts]]
- 5 edges to [[_COMMUNITY_RealtimeService]]
- 5 edges to [[_COMMUNITY_cycle-count.service.ts]]
- 4 edges to [[_COMMUNITY_CycleCountService]]
- 3 edges to [[_COMMUNITY_CodRecordsService]]
- 3 edges to [[_COMMUNITY_oms-sales-channel.service.ts]]
- 2 edges to [[_COMMUNITY_app.module.ts]]
- 2 edges to [[_COMMUNITY_ClientPrincipal]]
- 2 edges to [[_COMMUNITY_ClientStockService]]
- 2 edges to [[_COMMUNITY_AuditLogService]]
- 2 edges to [[_COMMUNITY_WarehouseTasksService]]
- 1 edge to [[_COMMUNITY_ProductsService]]
- 1 edge to [[_COMMUNITY_inventory-consistency.service.ts]]
- 1 edge to [[_COMMUNITY_NotificationsService]]
- 1 edge to [[_COMMUNITY_dot-validateResourceOwnership]]
- 1 edge to [[_COMMUNITY_ListAdjustmentsQueryDto]]
- 1 edge to [[_COMMUNITY_dot-fromPrincipal]]
- 1 edge to [[_COMMUNITY_ReturnsService]]
- 1 edge to [[_COMMUNITY_CycleCountExecutionService]]
- 1 edge to [[_COMMUNITY_outbound.service.ts]]
- 1 edge to [[_COMMUNITY_reliability-test-helpers.ts]]

## Top bridge nodes
- [[inventory.service.ts]] - degree 68, connects to 16 communities
- [[dot-internalTransfer()_1]] - degree 17, connects to 9 communities
- [[readCompanyIdFilterRequired()]] - degree 28, connects to 8 communities
- [[InventoryService]] - degree 30, connects to 7 communities
- [[dot-ledger()_1]] - degree 10, connects to 5 communities