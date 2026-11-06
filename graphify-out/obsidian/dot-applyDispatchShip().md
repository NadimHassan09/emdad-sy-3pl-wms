---
source_file: "backend/src/modules/warehouse-workflow/task-inventory-effects.service.ts"
type: "code"
community: "task-inventory-effects.service.ts"
location: "L536"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/task-inventory-effectsservicets
---

# .applyDispatchShip()

## Connections
- [[dot-appendIfAbsent()]] - `calls` [INFERRED]
- [[dot-complete()_3]] - `calls` [INFERRED]
- [[dot-decrementShippedWithMeta()]] - `calls` [INFERRED]
- [[dot-lockOutboundOrderRow()]] - `calls` [EXTRACTED]
- [[dot-safeSyncOmsFromOutbound()]] - `calls` [EXTRACTED]
- [[OrderNotificationTarget]] - `references` [EXTRACTED]
- [[TaskCompleteBody_1]] - `references` [EXTRACTED]
- [[TaskInventoryEffectsService]] - `method` [EXTRACTED]
- [[assertDiscreteUomPositiveIntegerDecimal()]] - `calls` [EXTRACTED]
- [[assertLocationUsableForInventoryMove()]] - `calls` [EXTRACTED]
- [[sortReservationSnapshotsForLocking()]] - `calls` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/task-inventory-effectsservicets