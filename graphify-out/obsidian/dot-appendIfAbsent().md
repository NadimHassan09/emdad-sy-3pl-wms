---
source_file: "backend/src/modules/inventory/ledger-idempotency.service.ts"
type: "code"
community: "task-inventory-effects.service.ts"
location: "L13"
tags:
  - graphify/code
  - graphify/INFERRED
  - community/task-inventory-effectsservicets
---

# .appendIfAbsent()

## Connections
- [[dot-applyDispatchShip()]] - `calls` [INFERRED]
- [[dot-applyLineInventory()]] - `calls` [INFERRED]
- [[dot-applyReceivingStaging()]] - `calls` [INFERRED]
- [[dot-confirmWarehouseReturnReceipt()]] - `calls` [INFERRED]
- [[dot-deductOutboundOrderLines()]] - `calls` [INFERRED]
- [[dot-quickDirectedOutbound()]] - `calls` [INFERRED]
- [[dot-rollbackReturn()_1]] - `calls` [INFERRED]
- [[dot-undoConfirmedReturn()_1]] - `calls` [INFERRED]
- [[LedgerIdempotencyService]] - `method` [EXTRACTED]

#graphify/code #graphify/INFERRED #community/task-inventory-effectsservicets