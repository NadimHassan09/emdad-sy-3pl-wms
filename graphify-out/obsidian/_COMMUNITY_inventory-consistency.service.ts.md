---
type: community
cohesion: 0.17
members: 26
---

# inventory-consistency.service.ts

**Cohesion:** 0.17 - loosely connected
**Members:** 26 nodes

## Members
- [[dot-assertScopeHealthy()]] - code - backend/src/modules/inventory/inventory-consistency.service.ts
- [[dot-checkConcurrentActivePicks()]] - code - backend/src/modules/inventory/inventory-consistency.service.ts
- [[dot-checkCurrentStockRows()]] - code - backend/src/modules/inventory/inventory-consistency.service.ts
- [[dot-checkOutboundLineQuantities()]] - code - backend/src/modules/inventory/inventory-consistency.service.ts
- [[dot-checkReservationTableDrift()]] - code - backend/src/modules/inventory/inventory-consistency.service.ts
- [[dot-checkStalePickSnapshots()]] - code - backend/src/modules/inventory/inventory-consistency.service.ts
- [[dot-checkTaskReservationDrift()]] - code - backend/src/modules/inventory/inventory-consistency.service.ts
- [[dot-constructor()_52]] - code - backend/src/modules/inventory/inventory-consistency.service.ts
- [[dot-runValidation()]] - code - backend/src/modules/inventory/inventory-consistency.service.ts
- [[dot-validateForUser()]] - code - backend/src/modules/inventory/inventory-consistency.service.ts
- [[DRIFT_EPSILON]] - code - backend/src/modules/inventory/inventory-consistency.service.ts
- [[Injectable_25]] - code
- [[InventoryConsistencyCode]] - code - backend/src/modules/inventory/inventory-consistency.types.ts
- [[InventoryConsistencyFinding]] - code - backend/src/modules/inventory/inventory-consistency.types.ts
- [[InventoryConsistencyReport]] - code - backend/src/modules/inventory/inventory-consistency.types.ts
- [[InventoryConsistencyService]] - code - backend/src/modules/inventory/inventory-consistency.service.ts
- [[InventoryConsistencySeverity]] - code - backend/src/modules/inventory/inventory-consistency.types.ts
- [[PickReservationSlice]] - code - backend/src/modules/inventory/inventory-consistency.service.ts
- [[StockTupleKey]] - code - backend/src/modules/inventory/inventory-consistency.service.ts
- [[countBySeverity()]] - code - backend/src/modules/inventory/inventory-consistency.service.ts
- [[inventory-consistency.service.ts]] - code - backend/src/modules/inventory/inventory-consistency.service.ts
- [[inventory-consistency.types.ts]] - code - backend/src/modules/inventory/inventory-consistency.types.ts
- [[isRecord()_3]] - code - backend/src/modules/inventory/inventory-consistency.service.ts
- [[pushFinding()]] - code - backend/src/modules/inventory/inventory-consistency.service.ts
- [[reservationRowsFromExec()]] - code - backend/src/modules/inventory/inventory-consistency.service.ts
- [[stockTupleKey()]] - code - backend/src/modules/inventory/inventory-consistency.service.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/inventory-consistencyservicets
SORT file.name ASC
```

## Connections to other communities
- 11 edges to [[_COMMUNITY_@prismaclient]]
- 4 edges to [[_COMMUNITY_reliability-test-helpers.ts]]
- 4 edges to [[_COMMUNITY_task-inventory-effects.service.ts]]
- 3 edges to [[_COMMUNITY_outbound.service.ts]]
- 2 edges to [[_COMMUNITY_class-validator]]
- 2 edges to [[_COMMUNITY_app.module.ts]]
- 2 edges to [[_COMMUNITY_AuthPrincipal]]
- 1 edge to [[_COMMUNITY_inventory.service.ts]]
- 1 edge to [[_COMMUNITY_CurrentUser]]
- 1 edge to [[_COMMUNITY_@nestjscommon]]

## Top bridge nodes
- [[inventory-consistency.service.ts]] - degree 28, connects to 8 communities
- [[InventoryConsistencyService]] - degree 21, connects to 5 communities
- [[dot-validateForUser()]] - degree 6, connects to 3 communities
- [[dot-assertScopeHealthy()]] - degree 3, connects to 1 community
- [[dot-constructor()_52]] - degree 3, connects to 1 community