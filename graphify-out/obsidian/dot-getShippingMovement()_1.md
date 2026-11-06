---
source_file: "backend/src/modules/oms/oms-orders.service.ts"
type: "code"
community: "withTenantRls"
location: "L1231"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/withTenantRls
---

# .getShippingMovement()

## Connections
- [[dot-getLocalShipmentMovement()]] - `calls` [INFERRED]
- [[dot-getShipmentTrackingHistory()]] - `calls` [INFERRED]
- [[dot-getShippingMovement()]] - `calls` [INFERRED]
- [[dot-resolveOrder()]] - `calls` [EXTRACTED]
- [[dot-shippingMovement()]] - `calls` [INFERRED]
- [[AuthPrincipal]] - `references` [EXTRACTED]
- [[OmsOrdersService]] - `method` [EXTRACTED]
- [[isAwbPendingReassignment()]] - `calls` [EXTRACTED]
- [[resolveShippingCarrierName()]] - `calls` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/withTenantRls