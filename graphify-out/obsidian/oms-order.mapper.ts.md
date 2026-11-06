---
source_file: "backend/src/modules/oms/oms-order.mapper.ts"
type: "code"
community: "withTenantRls"
location: "L1"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/withTenantRls
---

# oms-order.mapper.ts

## Connections
- [[@prismaclient]] - `imports_from` [EXTRACTED]
- [[OmsOrderLineWithProduct]] - `contains` [EXTRACTED]
- [[OmsOrderWithRelations]] - `contains` [EXTRACTED]
- [[buildLegacyDestination()]] - `contains` [EXTRACTED]
- [[client-oms-orders.service.ts]] - `imports_from` [EXTRACTED]
- [[composeDestinationAddress()]] - `contains` [EXTRACTED]
- [[computeSubtotal()]] - `contains` [EXTRACTED]
- [[computeTotal()]] - `contains` [EXTRACTED]
- [[dec()_5]] - `contains` [EXTRACTED]
- [[deriveCodStatus()]] - `contains` [EXTRACTED]
- [[isAwbPendingReassignment()]] - `imports` [EXTRACTED]
- [[isCancellationUnconfirmed()]] - `imports` [EXTRACTED]
- [[isProviderName()]] - `imports` [EXTRACTED]
- [[linesSum()]] - `contains` [EXTRACTED]
- [[liveAwbPending()]] - `contains` [EXTRACTED]
- [[liveShipmentTracking()]] - `contains` [EXTRACTED]
- [[mapOutboundStatusToOms()]] - `contains` [EXTRACTED]
- [[oms-batch.service.ts]] - `imports_from` [EXTRACTED]
- [[oms-order.mapper.unit.spec.ts]] - `imports_from` [EXTRACTED]
- [[oms-orders.service.ts]] - `imports_from` [EXTRACTED]
- [[oms-outbound-sync.service.ts]] - `imports_from` [EXTRACTED]
- [[oms-ready-to-ship-lifecycle.unit.spec.ts]] - `imports_from` [EXTRACTED]
- [[omsEventTypeForStatus()]] - `contains` [EXTRACTED]
- [[outbound.service.ts]] - `imports_from` [EXTRACTED]
- [[pickActiveCarrierShipment()]] - `imports` [EXTRACTED]
- [[resolveShippingCarrierName()]] - `imports` [EXTRACTED]
- [[serializeOmsOrder()]] - `contains` [EXTRACTED]
- [[serializeOmsOrderLine()]] - `contains` [EXTRACTED]
- [[serializeOmsOrderListItem()]] - `contains` [EXTRACTED]
- [[shipping-carrier-resolver.ts]] - `imports_from` [EXTRACTED]
- [[shipping-lifecycle.util.ts]] - `imports_from` [EXTRACTED]
- [[shipping-lookup.util.ts]] - `imports_from` [EXTRACTED]
- [[shipping.service.ts]] - `imports_from` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/withTenantRls