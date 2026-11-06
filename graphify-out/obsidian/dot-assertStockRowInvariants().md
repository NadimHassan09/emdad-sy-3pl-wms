---
source_file: "backend/src/modules/inventory/inventory-consistency.service.ts"
type: "code"
community: "task-inventory-effects.service.ts"
location: "L118"
tags:
  - graphify/code
  - graphify/INFERRED
  - community/task-inventory-effectsservicets
---

# .assertStockRowInvariants()

## Connections
- [[dot-decrementShippedWithMeta()]] - `calls` [INFERRED]
- [[dot-incrementReservedWithMeta()]] - `calls` [INFERRED]
- [[dot-releaseReservedWithMeta()]] - `calls` [INFERRED]
- [[InventoryConsistencyService]] - `method` [EXTRACTED]
- [[InventoryIntegrityException]] - `calls` [EXTRACTED]

#graphify/code #graphify/INFERRED #community/task-inventory-effectsservicets