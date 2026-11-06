---
source_file: "backend/src/modules/returns/return-inventory.service.ts"
type: "code"
community: "returns.service.ts"
location: "L50"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/returnsservicets
---

# .applyLineInventory()

## Connections
- [[dot-appendIfAbsent()]] - `calls` [INFERRED]
- [[dot-applyDisposition()]] - `calls` [INFERRED]
- [[dot-movementTypeForDisposition()]] - `calls` [EXTRACTED]
- [[dot-setStockStatus()_1]] - `calls` [EXTRACTED]
- [[dot-upsertPositiveWithMeta()]] - `calls` [INFERRED]
- [[ReturnInventoryService]] - `method` [EXTRACTED]
- [[assertLocationAllowedForDisposition()]] - `calls` [EXTRACTED]
- [[assertLocationUsableForInventoryMove()]] - `calls` [EXTRACTED]
- [[isInventoryPostingDisposition()]] - `calls` [EXTRACTED]
- [[normalizeReturnDisposition()]] - `calls` [EXTRACTED]
- [[stockStatusForDisposition()]] - `calls` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/returnsservicets