---
type: community
cohesion: 0.04
members: 99
---

# task-inventory-effects.service.ts

**Cohesion:** 0.04 - loosely connected
**Members:** 99 nodes

## Members
- [[dot-appendIfAbsent()]] - code - backend/src/modules/inventory/ledger-idempotency.service.ts
- [[dot-applyDispatchShip()]] - code - backend/src/modules/warehouse-workflow/task-inventory-effects.service.ts
- [[dot-applyPackRecord()]] - code - backend/src/modules/warehouse-workflow/task-inventory-effects.service.ts
- [[dot-applyPickRecord()]] - code - backend/src/modules/warehouse-workflow/task-inventory-effects.service.ts
- [[dot-applyPickRecordCore()]] - code - backend/src/modules/warehouse-workflow/task-inventory-effects.service.ts
- [[dot-applyPickRecordQuiet()]] - code - backend/src/modules/warehouse-workflow/task-inventory-effects.service.ts
- [[dot-applyPutaway()]] - code - backend/src/modules/warehouse-workflow/task-inventory-effects.service.ts
- [[dot-applyQcLines()]] - code - backend/src/modules/warehouse-workflow/task-inventory-effects.service.ts
- [[dot-applyReceivingStaging()]] - code - backend/src/modules/warehouse-workflow/task-inventory-effects.service.ts
- [[dot-applyShippingDetailsTaskComplete()]] - code - backend/src/modules/warehouse-workflow/task-inventory-effects.service.ts
- [[dot-approve()_6]] - code - backend/src/modules/adjustments/adjustments.service.ts
- [[dot-assertPickCompletionMatchesReservations()]] - code - backend/src/modules/warehouse-workflow/task-inventory-effects.service.ts
- [[dot-assertStockRowInvariants()]] - code - backend/src/modules/inventory/inventory-consistency.service.ts
- [[dot-buildPickReservations()]] - code - backend/src/modules/warehouse-workflow/task-inventory-effects.service.ts
- [[dot-constructor()_137]] - code - backend/src/common/errors/domain-exceptions.ts
- [[dot-constructor()_138]] - code - backend/src/modules/billing/billing-access.service.ts
- [[dot-constructor()_139]] - code - backend/src/modules/inbound/inbound.service.ts
- [[dot-constructor()_140]] - code - backend/src/modules/inventory/stock.helpers.ts
- [[dot-constructor()_141]] - code - backend/src/modules/oms/oms-order-events.service.ts
- [[dot-constructor()_142]] - code - backend/src/modules/oms/oms-orders.service.ts
- [[dot-constructor()_143]] - code - backend/src/modules/oms/oms-outbound-sync.service.ts
- [[dot-constructor()_144]] - code - backend/src/modules/oms/order-allocation.service.ts
- [[dot-constructor()_145]] - code - backend/src/modules/outbound/outbound.service.ts
- [[dot-constructor()_146]] - code - backend/src/modules/products/products.service.ts
- [[dot-constructor()_147]] - code - backend/src/modules/warehouse-workflow/task-inventory-effects.service.ts
- [[dot-decrement()]] - code - backend/src/modules/inventory/stock.helpers.ts
- [[dot-decrementShippedWithMeta()]] - code - backend/src/modules/inventory/stock.helpers.ts
- [[dot-decrementWithMeta()]] - code - backend/src/modules/inventory/stock.helpers.ts
- [[dot-incrementReservedWithMeta()]] - code - backend/src/modules/inventory/stock.helpers.ts
- [[dot-listForOutboundOrder()]] - code - backend/src/modules/oms/oms-order-events.service.ts
- [[dot-loadActivePickReservations()]] - code - backend/src/modules/warehouse-workflow/task-inventory-effects.service.ts
- [[dot-loadActiveReservationSnapshots()]] - code - backend/src/modules/oms/order-allocation.service.ts
- [[dot-lockOutboundOrderRow()]] - code - backend/src/modules/warehouse-workflow/task-inventory-effects.service.ts
- [[dot-lockQuantityOnHand()]] - code - backend/src/modules/inventory/stock.helpers.ts
- [[dot-mergeReservationSnapshots()]] - code - backend/src/modules/warehouse-workflow/task-inventory-effects.service.ts
- [[dot-readOnHandForUpdate()]] - code - backend/src/modules/inventory/stock.helpers.ts
- [[dot-refreshInboundOrderStatus()]] - code - backend/src/modules/warehouse-workflow/task-inventory-effects.service.ts
- [[dot-releaseReservations()]] - code - backend/src/modules/warehouse-workflow/task-inventory-effects.service.ts
- [[dot-releaseReservedWithMeta()]] - code - backend/src/modules/inventory/stock.helpers.ts
- [[dot-resolvePutawayLotFromStaging()]] - code - backend/src/modules/warehouse-workflow/task-inventory-effects.service.ts
- [[dot-safeSyncOmsFromOutbound()]] - code - backend/src/modules/warehouse-workflow/task-inventory-effects.service.ts
- [[dot-scheduleReadyForShippingHook()]] - code - backend/src/modules/warehouse-workflow/task-inventory-effects.service.ts
- [[dot-setStockStatus()]] - code - backend/src/modules/inventory/stock.helpers.ts
- [[dot-sumActiveReservedForProduct()]] - code - backend/src/modules/oms/order-allocation.service.ts
- [[dot-undoConfirmedReturn()_1]] - code - backend/src/modules/shipping/shipping-auto-return.service.ts
- [[dot-upsertPositive()]] - code - backend/src/modules/inventory/stock.helpers.ts
- [[dot-upsertPositiveWithMeta()]] - code - backend/src/modules/inventory/stock.helpers.ts
- [[AllocationLineInput]] - code - backend/src/modules/oms/order-allocation.service.ts
- [[BillingAccessService]] - code - backend/src/modules/billing/billing-access.service.ts
- [[DISCRETE_PRODUCT_UOMS]] - code - backend/src/common/utils/discrete-uom-quantity.ts
- [[Inject_3]] - code
- [[Inject_4]] - code
- [[Inject_5]] - code
- [[Injectable_87]] - code
- [[Injectable_88]] - code
- [[Injectable_89]] - code
- [[Injectable_90]] - code
- [[Injectable_91]] - code
- [[InsufficientStockException]] - code - backend/src/common/errors/domain-exceptions.ts
- [[NegativeMovement]] - code - backend/src/modules/inventory/stock.helpers.ts
- [[OmsOrderEventsService]] - code - backend/src/modules/oms/oms-order-events.service.ts
- [[OmsOutboundSyncService]] - code - backend/src/modules/oms/oms-outbound-sync.service.ts
- [[Optional_1]] - code
- [[Optional_2]] - code
- [[Optional_3]] - code
- [[Optional_4]] - code
- [[Optional_5]] - code
- [[OrderAllocationService]] - code - backend/src/modules/oms/order-allocation.service.ts
- [[PositiveMovement]] - code - backend/src/modules/inventory/stock.helpers.ts
- [[QuantityMeta]] - code - backend/src/modules/inventory/stock.helpers.ts
- [[ReservationSnapshot]] - code - backend/src/modules/warehouse-workflow/task-inventory-effects.service.ts
- [[StockHelpers]] - code - backend/src/modules/inventory/stock.helpers.ts
- [[TaskCompleteBody_1]] - code - backend/src/vendor/wms-task-execution/complete.ts
- [[TaskInventoryEffectsService]] - code - backend/src/modules/warehouse-workflow/task-inventory-effects.service.ts
- [[Tx_4]] - code - backend/src/modules/inventory/stock.helpers.ts
- [[Tx_5]] - code - backend/src/modules/oms/order-allocation.service.ts
- [[allocateOnOrderCreate()]] - code - backend/src/modules/warehouse-workflow/feature-flags.ts
- [[assertDiscreteUomNonNegativeIntegerDecimal()]] - code - backend/src/common/utils/discrete-uom-quantity.ts
- [[assertDiscreteUomPositiveIntegerDecimal()]] - code - backend/src/common/utils/discrete-uom-quantity.ts
- [[assertDiscreteUomPositiveIntegerQuantity()]] - code - backend/src/common/utils/discrete-uom-quantity.ts
- [[buildService()_8]] - code - backend/src/modules/oms/order-allocation.service.unit.spec.ts
- [[compareStockTupleLockKeys()]] - code - backend/src/modules/warehouse-workflow/pick-concurrency.util.ts
- [[dec()_2]] - code - backend/src/modules/oms/order-allocation.service.unit.spec.ts
- [[discrete-uom-quantity.ts]] - code - backend/src/common/utils/discrete-uom-quantity.ts
- [[discrete-uom-quantity.unit.spec.ts]] - code - backend/src/common/utils/discrete-uom-quantity.unit.spec.ts
- [[findCompanyStockFefo()]] - code - backend/src/modules/warehouse-workflow/task-allocation.helper.ts
- [[findWarehouseStockFefo()]] - code - backend/src/modules/warehouse-workflow/task-allocation.helper.ts
- [[isDiscreteProductUom()]] - code - backend/src/common/utils/discrete-uom-quantity.ts
- [[order-allocation.service.ts]] - code - backend/src/modules/oms/order-allocation.service.ts
- [[order-allocation.service.unit.spec.ts]] - code - backend/src/modules/oms/order-allocation.service.unit.spec.ts
- [[parseExpiryFromDiscrepancyNotes()]] - code - backend/src/modules/warehouse-workflow/task-inventory-effects.service.ts
- [[pick-concurrency.util.ts]] - code - backend/src/modules/warehouse-workflow/pick-concurrency.util.ts
- [[resolveReceivingLotExpiry()]] - code - backend/src/modules/warehouse-workflow/task-inventory-effects.service.ts
- [[sortPickLinesForLocking()]] - code - backend/src/modules/warehouse-workflow/pick-concurrency.util.ts
- [[sortReservationSnapshotsForLocking()]] - code - backend/src/modules/warehouse-workflow/pick-concurrency.util.ts
- [[stock.helpers.ts]] - code - backend/src/modules/inventory/stock.helpers.ts
- [[stockTupleLockKey()]] - code - backend/src/modules/warehouse-workflow/pick-concurrency.util.ts
- [[task-allocation.helper.ts]] - code - backend/src/modules/warehouse-workflow/task-allocation.helper.ts
- [[task-inventory-effects.service.ts]] - code - backend/src/modules/warehouse-workflow/task-inventory-effects.service.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/task-inventory-effectsservicets
SORT file.name ASC
```

## Connections to other communities
- 53 edges to [[_COMMUNITY_outbound.service.ts]]
- 35 edges to [[_COMMUNITY_@prismaclient]]
- 32 edges to [[_COMMUNITY_withTenantRls]]
- 17 edges to [[_COMMUNITY_WarehouseTasksService]]
- 17 edges to [[_COMMUNITY_warehouse-tasks.service.ts]]
- 17 edges to [[_COMMUNITY_returns.service.ts]]
- 13 edges to [[_COMMUNITY_reliability-test-helpers.ts]]
- 12 edges to [[_COMMUNITY_app.module.ts]]
- 11 edges to [[_COMMUNITY_cycle-count.service.ts]]
- 11 edges to [[_COMMUNITY_oms-client-import.service.ts]]
- 7 edges to [[_COMMUNITY_RealtimeService]]
- 5 edges to [[_COMMUNITY_inventory.service.ts]]
- 5 edges to [[_COMMUNITY_AuditLogService]]
- 5 edges to [[_COMMUNITY_@nestjscommon]]
- 4 edges to [[_COMMUNITY_shipping.service.ts]]
- 4 edges to [[_COMMUNITY_dot-validateResourceOwnership]]
- 4 edges to [[_COMMUNITY_EncryptionService]]
- 4 edges to [[_COMMUNITY_CodRecordsService]]
- 4 edges to [[_COMMUNITY_inventory-consistency.service.ts]]
- 4 edges to [[_COMMUNITY_NotificationsService]]
- 3 edges to [[_COMMUNITY_dot-fromPrincipal]]
- 3 edges to [[_COMMUNITY_BillingInvoiceCalculationService]]
- 3 edges to [[_COMMUNITY_backendsrcvendorwms-task-executionregistry.ts]]
- 3 edges to [[_COMMUNITY_outbound-orders-csv.service.ts]]
- 3 edges to [[_COMMUNITY_inbound-orders-csv.service.ts]]
- 3 edges to [[_COMMUNITY_oms-instruction-pdf.service.ts]]
- 2 edges to [[_COMMUNITY_AuthPrincipal]]
- 1 edge to [[_COMMUNITY_ProductsService]]
- 1 edge to [[_COMMUNITY_shipping-tracking.service.ts]]
- 1 edge to [[_COMMUNITY_client-oms-orders.service.ts]]
- 1 edge to [[_COMMUNITY_ClientPrincipal]]
- 1 edge to [[_COMMUNITY_shipping-fee.service.ts]]
- 1 edge to [[_COMMUNITY_backendsrcvendorwms-task-executioncomplete.ts]]
- 1 edge to [[_COMMUNITY_AdjustmentsController]]
- 1 edge to [[_COMMUNITY_ReturnsService]]

## Top bridge nodes
- [[dot-constructor()_145]] - degree 20, connects to 10 communities
- [[dot-constructor()_142]] - degree 19, connects to 10 communities
- [[task-inventory-effects.service.ts]] - degree 39, connects to 9 communities
- [[assertDiscreteUomPositiveIntegerQuantity()]] - degree 31, connects to 9 communities
- [[stock.helpers.ts]] - degree 21, connects to 9 communities