---
source_file: "backend/src/modules/inventory/stock.helpers.ts"
type: "code"
community: "task-inventory-effects.service.ts"
location: "L410"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/task-inventory-effectsservicets
---

# .decrementShippedWithMeta()

## Connections
- [[dot-applyDispatchShip()]] - `calls` [INFERRED]
- [[dot-assertStockRowInvariants()]] - `calls` [INFERRED]
- [[dot-lockQuantityOnHand()]] - `calls` [EXTRACTED]
- [[InsufficientStockException]] - `calls` [EXTRACTED]
- [[StockHelpers]] - `method` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/task-inventory-effectsservicets