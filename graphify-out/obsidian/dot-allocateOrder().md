---
source_file: "backend/src/modules/oms/order-allocation.service.ts"
type: "code"
community: "withTenantRls"
location: "L73"
tags:
  - graphify/code
  - graphify/INFERRED
  - community/withTenantRls
---

# .allocateOrder()

## Connections
- [[dot-allocateInboundSources()]] - `calls` [INFERRED]
- [[dot-allocateLinkedOutbound()]] - `calls` [INFERRED]
- [[dot-create()_45]] - `calls` [INFERRED]
- [[dot-createOutboundFromOms()]] - `calls` [INFERRED]
- [[dot-isEnabled()_3]] - `calls` [EXTRACTED]
- [[dot-record()]] - `calls` [INFERRED]
- [[dot-revertCancel()_1]] - `calls` [INFERRED]
- [[dot-tryAllocateOnConfirm()]] - `calls` [INFERRED]
- [[dot-updatePlan()_6]] - `calls` [INFERRED]
- [[InsufficientStockException]] - `calls` [EXTRACTED]
- [[OrderAllocationService]] - `method` [EXTRACTED]
- [[findCompanyStockFefo()]] - `calls` [EXTRACTED]
- [[findWarehouseStockFefo()]] - `calls` [EXTRACTED]

#graphify/code #graphify/INFERRED #community/withTenantRls