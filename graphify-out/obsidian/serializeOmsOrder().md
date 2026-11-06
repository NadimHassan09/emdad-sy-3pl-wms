---
source_file: "backend/src/modules/oms/oms-order.mapper.ts"
type: "code"
community: "withTenantRls"
location: "L216"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/withTenantRls
---

# serializeOmsOrder()

## Connections
- [[dot-allocate()_1]] - `calls` [EXTRACTED]
- [[dot-approve()_7]] - `calls` [EXTRACTED]
- [[dot-cancel()_13]] - `calls` [EXTRACTED]
- [[dot-cancelShipment()_5]] - `calls` [EXTRACTED]
- [[dot-confirm()_9]] - `calls` [EXTRACTED]
- [[dot-confirmReturnReceipt()_1]] - `calls` [EXTRACTED]
- [[dot-create()_44]] - `calls` [EXTRACTED]
- [[dot-findById()_15]] - `calls` [EXTRACTED]
- [[dot-listForExport()_3]] - `calls` [EXTRACTED]
- [[dot-listForExport()_5]] - `indirect_call` [INFERRED]
- [[dot-markDelivered()]] - `calls` [EXTRACTED]
- [[dot-markFailedDelivery()]] - `calls` [EXTRACTED]
- [[dot-markReturned()]] - `calls` [EXTRACTED]
- [[dot-recordExternalFulfillment()_1]] - `calls` [EXTRACTED]
- [[dot-reject()_3]] - `calls` [EXTRACTED]
- [[dot-releaseAllocation()_1]] - `calls` [EXTRACTED]
- [[dot-revertCancel()_1]] - `calls` [EXTRACTED]
- [[dot-revertDelivery()]] - `calls` [EXTRACTED]
- [[dot-transition()]] - `calls` [EXTRACTED]
- [[dot-update()_13]] - `calls` [EXTRACTED]
- [[buildLegacyDestination()]] - `calls` [EXTRACTED]
- [[client-oms-orders.service.ts]] - `imports` [EXTRACTED]
- [[computeSubtotal()]] - `calls` [EXTRACTED]
- [[computeTotal()]] - `calls` [EXTRACTED]
- [[dec()_5]] - `calls` [EXTRACTED]
- [[isCancellationUnconfirmed()]] - `calls` [EXTRACTED]
- [[isProviderName()]] - `calls` [EXTRACTED]
- [[liveAwbPending()]] - `calls` [EXTRACTED]
- [[liveShipmentTracking()]] - `calls` [EXTRACTED]
- [[oms-order.mapper.ts]] - `contains` [EXTRACTED]
- [[oms-order.mapper.unit.spec.ts]] - `imports` [EXTRACTED]
- [[oms-orders.service.ts]] - `imports` [EXTRACTED]
- [[pickActiveCarrierShipment()]] - `calls` [EXTRACTED]
- [[resolveShippingCarrierName()]] - `calls` [EXTRACTED]
- [[serializeOmsOrderLine()]] - `indirect_call` [INFERRED]

#graphify/code #graphify/EXTRACTED #community/withTenantRls