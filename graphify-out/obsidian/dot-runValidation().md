---
source_file: "backend/src/modules/inventory/inventory-consistency.service.ts"
type: "code"
community: "inventory-consistency.service.ts"
location: "L85"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/inventory-consistencyservicets
---

# .runValidation()

## Connections
- [[dot-assertScopeHealthy()]] - `calls` [EXTRACTED]
- [[dot-checkConcurrentActivePicks()]] - `calls` [EXTRACTED]
- [[dot-checkCurrentStockRows()]] - `calls` [EXTRACTED]
- [[dot-checkOutboundLineQuantities()]] - `calls` [EXTRACTED]
- [[dot-checkReservationTableDrift()]] - `calls` [EXTRACTED]
- [[dot-checkStalePickSnapshots()]] - `calls` [EXTRACTED]
- [[dot-checkTaskReservationDrift()]] - `calls` [EXTRACTED]
- [[dot-validateForUser()]] - `calls` [EXTRACTED]
- [[InventoryConsistencyReport]] - `references` [EXTRACTED]
- [[InventoryConsistencyService]] - `method` [EXTRACTED]
- [[countBySeverity()]] - `calls` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/inventory-consistencyservicets