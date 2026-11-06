---
source_file: "backend/src/modules/warehouse-workflow/task-inventory-effects.service.ts"
type: "code"
community: "task-inventory-effects.service.ts"
location: "L1"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/task-inventory-effectsservicets
---

# task-inventory-effects.service.ts

## Connections
- [[@nestjscommon]] - `imports_from` [EXTRACTED]
- [[@nestjscore]] - `imports_from` [EXTRACTED]
- [[@prismaclient]] - `imports_from` [EXTRACTED]
- [[InvalidLocationTypeException]] - `imports` [EXTRACTED]
- [[LedgerIdempotencyService]] - `imports` [EXTRACTED]
- [[LotRequiredException]] - `imports` [EXTRACTED]
- [[OmsOutboundSyncService]] - `imports` [EXTRACTED]
- [[OrderNotificationTarget]] - `imports` [EXTRACTED]
- [[ReservationSnapshot]] - `contains` [EXTRACTED]
- [[ShippingHandoffHookService]] - `imports` [EXTRACTED]
- [[StockHelpers]] - `imports` [EXTRACTED]
- [[TaskCompleteBody_1]] - `imports` [EXTRACTED]
- [[TaskInventoryEffectsService]] - `contains` [EXTRACTED]
- [[assertDiscreteUomNonNegativeIntegerDecimal()]] - `imports` [EXTRACTED]
- [[assertDiscreteUomPositiveIntegerDecimal()]] - `imports` [EXTRACTED]
- [[assertLocationUsableForInventoryMove()]] - `imports` [EXTRACTED]
- [[discrete-uom-quantity.ts]] - `imports_from` [EXTRACTED]
- [[domain-exceptions.ts]] - `imports_from` [EXTRACTED]
- [[findWarehouseStockFefo()]] - `imports` [EXTRACTED]
- [[isQuarantineStorageLocationType()]] - `imports` [EXTRACTED]
- [[ledger-idempotency.service.ts]] - `imports_from` [EXTRACTED]
- [[location-operational.ts]] - `imports_from` [EXTRACTED]
- [[notifications.service.ts]] - `imports_from` [EXTRACTED]
- [[oms-outbound-sync.service.ts]] - `imports_from` [EXTRACTED]
- [[order-allocation.service.ts]] - `imports_from` [EXTRACTED]
- [[parseExpiryFromDiscrepancyNotes()]] - `contains` [EXTRACTED]
- [[pick-concurrency.util.ts]] - `imports_from` [EXTRACTED]
- [[reliability-test-helpers.ts]] - `imports_from` [EXTRACTED]
- [[resolveReceivingLotExpiry()]] - `contains` [EXTRACTED]
- [[shipping-handoff-hook.service.ts]] - `imports_from` [EXTRACTED]
- [[sortPickLinesForLocking()]] - `imports` [EXTRACTED]
- [[sortReservationSnapshotsForLocking()]] - `imports` [EXTRACTED]
- [[stock.helpers.ts]] - `imports_from` [EXTRACTED]
- [[storage-location-types.ts]] - `imports_from` [EXTRACTED]
- [[task-allocation.helper.ts]] - `imports_from` [EXTRACTED]
- [[task-payload.schema.ts]] - `imports_from` [EXTRACTED]
- [[warehouse-tasks.service.ts]] - `imports_from` [EXTRACTED]
- [[warehouse-workflow.module.ts]] - `imports_from` [EXTRACTED]
- [[workflow-recovery.service.ts]] - `imports_from` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/task-inventory-effectsservicets