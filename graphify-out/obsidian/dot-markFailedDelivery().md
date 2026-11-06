---
source_file: "backend/src/modules/oms/oms-orders.service.ts"
type: "code"
community: "withTenantRls"
location: "L1124"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/withTenantRls
---

# .markFailedDelivery()

## Connections
- [[dot-cancelUnconfirmedDraftReturns()]] - `calls` [INFERRED]
- [[dot-failedDelivery()]] - `calls` [INFERRED]
- [[dot-failedDeliveryBulk()_1]] - `calls` [INFERRED]
- [[dot-resolveOrder()]] - `calls` [EXTRACTED]
- [[dot-transition()]] - `calls` [EXTRACTED]
- [[AuthPrincipal]] - `references` [EXTRACTED]
- [[OmsOrdersService]] - `method` [EXTRACTED]
- [[assertOmsTransition()]] - `calls` [EXTRACTED]
- [[serializeOmsOrder()]] - `calls` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/withTenantRls