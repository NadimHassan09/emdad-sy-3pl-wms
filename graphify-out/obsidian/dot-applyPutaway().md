---
source_file: "backend/src/modules/warehouse-workflow/task-inventory-effects.service.ts"
type: "code"
community: "task-inventory-effects.service.ts"
location: "L346"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/task-inventory-effectsservicets
---

# .applyPutaway()

## Connections
- [[dot-complete()_3]] - `calls` [INFERRED]
- [[dot-decrementWithMeta()]] - `calls` [INFERRED]
- [[dot-resolvePutawayLotFromStaging()]] - `calls` [EXTRACTED]
- [[dot-setStockStatus()]] - `calls` [INFERRED]
- [[dot-upsertPositiveWithMeta()]] - `calls` [INFERRED]
- [[InvalidLocationTypeException]] - `calls` [EXTRACTED]
- [[TaskCompleteBody_1]] - `references` [EXTRACTED]
- [[TaskInventoryEffectsService]] - `method` [EXTRACTED]
- [[assertDiscreteUomPositiveIntegerDecimal()]] - `calls` [EXTRACTED]
- [[assertLocationUsableForInventoryMove()]] - `calls` [EXTRACTED]
- [[isQuarantineStorageLocationType()]] - `calls` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/task-inventory-effectsservicets