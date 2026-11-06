---
source_file: "backend/src/modules/oms/oms-orders.service.ts"
type: "code"
community: "withTenantRls"
location: "L2684"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/withTenantRls
---

# .transition()

## Connections
- [[dot-emitOms()]] - `calls` [EXTRACTED]
- [[dot-emitOutboundOrderUpdated()]] - `calls` [INFERRED]
- [[dot-markFailedDelivery()]] - `calls` [EXTRACTED]
- [[dot-markOutForDelivery()]] - `calls` [EXTRACTED]
- [[dot-record()]] - `calls` [INFERRED]
- [[dot-validateResourceOwnership()]] - `calls` [INFERRED]
- [[AuthPrincipal]] - `references` [EXTRACTED]
- [[InvalidStateException]] - `calls` [EXTRACTED]
- [[OmsOrdersService]] - `method` [EXTRACTED]
- [[adminOutboundListItem()]] - `calls` [EXTRACTED]
- [[serializeOmsOrder()]] - `calls` [EXTRACTED]
- [[withTenantRls()]] - `calls` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/withTenantRls