---
source_file: "backend/src/modules/oms/oms-orders.service.ts"
type: "code"
community: "withTenantRls"
location: "L2401"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/withTenantRls
---

# .markReturned()

## Connections
- [[dot-processCarrierReturnEvent()]] - `calls` [INFERRED]
- [[dot-resolveOrder()]] - `calls` [EXTRACTED]
- [[dot-returned()]] - `calls` [INFERRED]
- [[dot-returnedBulk()_1]] - `calls` [INFERRED]
- [[AuthPrincipal]] - `references` [EXTRACTED]
- [[InvalidStateException]] - `calls` [EXTRACTED]
- [[OmsOrdersService]] - `method` [EXTRACTED]
- [[assertOmsTransition()]] - `calls` [EXTRACTED]
- [[serializeOmsOrder()]] - `calls` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/withTenantRls