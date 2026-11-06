---
type: community
cohesion: 0.06
members: 61
---

# returns.service.ts

**Cohesion:** 0.06 - loosely connected
**Members:** 61 nodes

## Members
- [[dot-addLine()_2]] - code - backend/src/modules/adjustments/adjustments.service.ts
- [[dot-applyDisposition()]] - code - backend/src/modules/returns/return-workflow.service.ts
- [[dot-applyLineInventory()]] - code - backend/src/modules/returns/return-inventory.service.ts
- [[dot-assertAllLinesPosted()]] - code - backend/src/modules/returns/return-workflow.service.ts
- [[dot-constructor()_206]] - code - backend/src/modules/returns/return-inventory.service.ts
- [[dot-constructor()_207]] - code - backend/src/modules/returns/return-workflow.service.ts
- [[dot-inspectLine()_1]] - code - backend/src/modules/returns/return-workflow.service.ts
- [[dot-loadOrder()]] - code - backend/src/modules/returns/return-workflow.service.ts
- [[dot-movementTypeForDisposition()]] - code - backend/src/modules/returns/return-inventory.service.ts
- [[dot-postAllEligibleLines()]] - code - backend/src/modules/returns/return-workflow.service.ts
- [[dot-postAllInventory()]] - code - backend/src/modules/returns/returns.service.ts
- [[dot-setStockStatus()_1]] - code - backend/src/modules/returns/return-inventory.service.ts
- [[dot-syncOrderWorkflowStatus()]] - code - backend/src/modules/returns/return-workflow.service.ts
- [[ADJUSTMENT_STOCK_LOCATION_TYPES]] - code - backend/src/common/constants/storage-location-types.ts
- [[INVENTORY_POSTING_DISPOSITIONS]] - code - backend/src/modules/returns/return-disposition.policy.ts
- [[Injectable_145]] - code
- [[Injectable_146]] - code
- [[MAX_RETURN_LINES_PER_ORDER]] - code - backend/src/modules/returns/returns.constants.ts
- [[NON_STORAGE_LOCATION_TYPES]] - code - backend/src/common/constants/storage-location-types.ts
- [[ORDER_INCLUDE_3]] - code - backend/src/modules/returns/return-workflow.service.ts
- [[ORDER_INCLUDE_4]] - code - backend/src/modules/returns/returns.service.ts
- [[OutboundReturnQuota]] - code - backend/src/modules/returns/return-quantity.validation.ts
- [[OutboundReturnQuotaLine]] - code - backend/src/modules/returns/return-quantity.validation.ts
- [[PENDING_INSPECTION_DISPOSITIONS]] - code - backend/src/modules/returns/return-disposition.policy.ts
- [[RETURN_ACTIVE_FOR_QUOTA]] - code - backend/src/modules/returns/returns.constants.ts
- [[RETURN_COMPLETABLE]] - code - backend/src/modules/returns/returns.constants.ts
- [[RETURN_CONFIRMABLE]] - code - backend/src/modules/returns/returns.constants.ts
- [[RETURN_INSPECTABLE]] - code - backend/src/modules/returns/returns.constants.ts
- [[RETURN_INVENTORY_APPLICABLE]] - code - backend/src/modules/returns/returns.constants.ts
- [[RETURN_RECEIVABLE]] - code - backend/src/modules/returns/returns.constants.ts
- [[RETURN_TERMINAL]] - code - backend/src/modules/returns/returns.constants.ts
- [[ReturnInventoryService]] - code - backend/src/modules/returns/return-inventory.service.ts
- [[ReturnLineInventoryContext]] - code - backend/src/modules/returns/return-inventory.service.ts
- [[ReturnLineQuantityInput]] - code - backend/src/modules/returns/return-quantity.validation.ts
- [[ReturnListLineSlice]] - code - backend/src/modules/returns/return-line-integrity.util.ts
- [[ReturnOrderListSummary]] - code - backend/src/modules/returns/return-line-integrity.util.ts
- [[ReturnWorkflowService]] - code - backend/src/modules/returns/return-workflow.service.ts
- [[Tx_9]] - code - backend/src/modules/returns/return-inventory.service.ts
- [[assertLocationAllowedForDisposition()]] - code - backend/src/modules/returns/return-disposition.policy.ts
- [[assertLocationUsableForInventoryMove()]] - code - backend/src/common/utils/location-operational.ts
- [[assertUniqueReturnLineBuckets()]] - code - backend/src/modules/returns/return-line-integrity.util.ts
- [[isAdjustmentStockLocationType()]] - code - backend/src/common/constants/storage-location-types.ts
- [[isInventoryPostingDisposition()]] - code - backend/src/modules/returns/return-disposition.policy.ts
- [[isPendingInspectionDisposition()]] - code - backend/src/modules/returns/return-disposition.policy.ts
- [[isQuarantineStorageLocationType()]] - code - backend/src/common/constants/storage-location-types.ts
- [[isReturnCompletable()]] - code - backend/src/modules/returns/returns.constants.ts
- [[isReturnConfirmable()]] - code - backend/src/modules/returns/returns.constants.ts
- [[isReturnInspectable()]] - code - backend/src/modules/returns/returns.constants.ts
- [[isReturnInventoryApplicable()]] - code - backend/src/modules/returns/returns.constants.ts
- [[isReturnReceivable()]] - code - backend/src/modules/returns/returns.constants.ts
- [[location-operational.ts]] - code - backend/src/common/utils/location-operational.ts
- [[normalizeReturnDisposition()]] - code - backend/src/modules/returns/return-disposition.policy.ts
- [[return-disposition.policy.ts]] - code - backend/src/modules/returns/return-disposition.policy.ts
- [[return-inventory.service.ts]] - code - backend/src/modules/returns/return-inventory.service.ts
- [[return-line-integrity.util.ts]] - code - backend/src/modules/returns/return-line-integrity.util.ts
- [[return-quantity.validation.ts]] - code - backend/src/modules/returns/return-quantity.validation.ts
- [[return-workflow.service.ts]] - code - backend/src/modules/returns/return-workflow.service.ts
- [[returns.constants.ts]] - code - backend/src/modules/returns/returns.constants.ts
- [[returns.service.ts]] - code - backend/src/modules/returns/returns.service.ts
- [[stockStatusForDisposition()]] - code - backend/src/modules/returns/return-disposition.policy.ts
- [[storage-location-types.ts]] - code - backend/src/common/constants/storage-location-types.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/returnsservicets
SORT file.name ASC
```

## Connections to other communities
- 30 edges to [[_COMMUNITY_@prismaclient]]
- 17 edges to [[_COMMUNITY_task-inventory-effects.service.ts]]
- 16 edges to [[_COMMUNITY_outbound.service.ts]]
- 13 edges to [[_COMMUNITY_returns.controller.ts]]
- 11 edges to [[_COMMUNITY_cycle-count.service.ts]]
- 9 edges to [[_COMMUNITY_class-validator]]
- 8 edges to [[_COMMUNITY_AuthPrincipal]]
- 8 edges to [[_COMMUNITY_@nestjscommon]]
- 7 edges to [[_COMMUNITY_ReturnsService]]
- 7 edges to [[_COMMUNITY_dot-fromPrincipal]]
- 7 edges to [[_COMMUNITY_inventory.service.ts]]
- 6 edges to [[_COMMUNITY_app.module.ts]]
- 6 edges to [[_COMMUNITY_AuditLogService]]
- 6 edges to [[_COMMUNITY_RealtimeService]]
- 5 edges to [[_COMMUNITY_dot-validateResourceOwnership]]
- 2 edges to [[_COMMUNITY_reliability-test-helpers.ts]]
- 2 edges to [[_COMMUNITY_WarehouseTasksService]]
- 1 edge to [[_COMMUNITY_AdjustmentsController]]
- 1 edge to [[_COMMUNITY_withTenantRls]]
- 1 edge to [[_COMMUNITY_EmptyToUndefined]]

## Top bridge nodes
- [[returns.service.ts]] - degree 57, connects to 17 communities
- [[return-workflow.service.ts]] - degree 31, connects to 9 communities
- [[dot-applyDisposition()]] - degree 15, connects to 7 communities
- [[dot-addLine()_2]] - degree 10, connects to 7 communities
- [[location-operational.ts]] - degree 8, connects to 6 communities