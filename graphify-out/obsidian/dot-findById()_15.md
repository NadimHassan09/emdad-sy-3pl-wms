---
source_file: "backend/src/modules/oms/oms-orders.service.ts"
type: "code"
community: "withTenantRls"
location: "L1196"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/withTenantRls
---

# .findById()

## Connections
- [[dot-findOne()_18]] - `calls` [INFERRED]
- [[dot-findOne()_5]] - `calls` [INFERRED]
- [[dot-getTraceabilityForOrder()]] - `calls` [INFERRED]
- [[dot-listForOrder()]] - `calls` [INFERRED]
- [[dot-lookupOrderNumber()_1]] - `calls` [INFERRED]
- [[dot-resolveOrder()]] - `calls` [EXTRACTED]
- [[AuthPrincipal]] - `references` [EXTRACTED]
- [[OmsOrdersService]] - `method` [EXTRACTED]
- [[canRevertCancel()]] - `calls` [EXTRACTED]
- [[resolveOmsActorRole()]] - `calls` [EXTRACTED]
- [[resolvePreviousOmsStatus()]] - `calls` [EXTRACTED]
- [[serializeOmsOrder()]] - `calls` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/withTenantRls