---
source_file: "backend/src/modules/outbound/outbound.service.ts"
type: "code"
community: "withTenantRls"
location: "L1495"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/withTenantRls
---

# .selectShippingMethodAdmin()

## Connections
- [[dot-completeShippingDetailsAdmin()]] - `calls` [EXTRACTED]
- [[dot-emitOutboundOrderUpdated()]] - `calls` [INFERRED]
- [[dot-findById()_16]] - `calls` [EXTRACTED]
- [[dot-processShippingDetailsItem()]] - `calls` [INFERRED]
- [[dot-resolveBabelNeighbourhoodId()]] - `calls` [INFERRED]
- [[dot-resolveReceiverCoordinatesFromAddress()]] - `calls` [INFERRED]
- [[dot-saveShippingDetails()_1]] - `calls` [EXTRACTED]
- [[dot-selectShippingMethod()]] - `calls` [INFERRED]
- [[dot-syncFromOutbound()]] - `calls` [INFERRED]
- [[AuthPrincipal]] - `references` [EXTRACTED]
- [[OutboundService]] - `method` [EXTRACTED]
- [[UpdateShippingDetailsDto]] - `references` [EXTRACTED]
- [[adminOutboundListItem()]] - `calls` [EXTRACTED]
- [[assertShippingIntentReady()]] - `calls` [EXTRACTED]
- [[composeDestinationAddress()]] - `calls` [EXTRACTED]
- [[shippingPackagesPrisma()]] - `calls` [EXTRACTED]
- [[shippingPrismaData()]] - `calls` [EXTRACTED]
- [[withTenantRls()]] - `calls` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/withTenantRls