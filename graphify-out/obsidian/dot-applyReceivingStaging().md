---
source_file: "backend/src/modules/warehouse-workflow/task-inventory-effects.service.ts"
type: "code"
community: "task-inventory-effects.service.ts"
location: "L219"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/task-inventory-effectsservicets
---

# .applyReceivingStaging()

## Connections
- [[dot-appendIfAbsent()]] - `calls` [INFERRED]
- [[dot-complete()_3]] - `calls` [INFERRED]
- [[dot-refreshInboundOrderStatus()]] - `calls` [EXTRACTED]
- [[dot-setStockStatus()]] - `calls` [INFERRED]
- [[dot-upsertPositive()]] - `calls` [INFERRED]
- [[LotRequiredException]] - `calls` [EXTRACTED]
- [[TaskCompleteBody_1]] - `references` [EXTRACTED]
- [[TaskInventoryEffectsService]] - `method` [EXTRACTED]
- [[assertDiscreteUomPositiveIntegerDecimal()]] - `calls` [EXTRACTED]
- [[assertLocationUsableForInventoryMove()]] - `calls` [EXTRACTED]
- [[resolveReceivingLotExpiry()]] - `calls` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/task-inventory-effectsservicets