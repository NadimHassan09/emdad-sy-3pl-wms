---
source_file: "backend/src/modules/outbound/outbound-bulk.service.ts"
type: "code"
community: "withTenantRls"
location: "L337"
tags:
  - graphify/code
  - graphify/INFERRED
  - community/withTenantRls
---

# .processShippingDetailsItem()

## Connections
- [[dot-completeShippingDetailsAdmin()]] - `calls` [INFERRED]
- [[dot-findById()_16]] - `calls` [INFERRED]
- [[dot-saveShippingDetails()_1]] - `calls` [INFERRED]
- [[dot-selectShippingMethodAdmin()]] - `calls` [INFERRED]
- [[dot-sendShippingDetails()]] - `calls` [INFERRED]
- [[dot-shippingDetailsBulk()]] - `calls` [EXTRACTED]
- [[AuthPrincipal]] - `references` [EXTRACTED]
- [[BulkShippingDetailsItemDto]] - `references` [EXTRACTED]
- [[OutboundBulkService]] - `method` [EXTRACTED]

#graphify/code #graphify/INFERRED #community/withTenantRls