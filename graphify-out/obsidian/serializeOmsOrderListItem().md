---
source_file: "backend/src/modules/oms/oms-order.mapper.ts"
type: "code"
community: "withTenantRls"
location: "L152"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/withTenantRls
---

# serializeOmsOrderListItem()

## Connections
- [[dot-get()_7]] - `calls` [EXTRACTED]
- [[dot-list()_54]] - `indirect_call` [INFERRED]
- [[computeTotal()]] - `calls` [EXTRACTED]
- [[dec()_5]] - `calls` [EXTRACTED]
- [[isCancellationUnconfirmed()]] - `calls` [EXTRACTED]
- [[liveAwbPending()]] - `calls` [EXTRACTED]
- [[liveShipmentTracking()]] - `calls` [EXTRACTED]
- [[oms-batch.service.ts]] - `imports` [EXTRACTED]
- [[oms-order.mapper.ts]] - `contains` [EXTRACTED]
- [[oms-order.mapper.unit.spec.ts]] - `imports` [EXTRACTED]
- [[oms-orders.service.ts]] - `imports` [EXTRACTED]
- [[pickActiveCarrierShipment()]] - `calls` [EXTRACTED]
- [[resolveShippingCarrierName()]] - `calls` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/withTenantRls