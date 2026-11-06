---
source_file: "backend/src/modules/outbound/outbound.service.ts"
type: "code"
community: "withTenantRls"
location: "L1652"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/withTenantRls
---

# .saveShippingDetails()

## Connections
- [[dot-clearCodCollection()]] - `calls` [INFERRED]
- [[dot-emitOutboundOrderUpdated()]] - `calls` [INFERRED]
- [[dot-findById()_16]] - `calls` [EXTRACTED]
- [[dot-processShippingDetailsItem()]] - `calls` [INFERRED]
- [[dot-record()]] - `calls` [INFERRED]
- [[dot-resolveBabelNeighbourhoodId()]] - `calls` [INFERRED]
- [[dot-resolveReceiverCoordinatesFromAddress()]] - `calls` [INFERRED]
- [[dot-saveCodCollection()]] - `calls` [INFERRED]
- [[dot-saveShippingDetails()]] - `calls` [INFERRED]
- [[dot-selectShippingMethodAdmin()]] - `calls` [EXTRACTED]
- [[dot-supersedeUnconfirmedShipments()]] - `calls` [EXTRACTED]
- [[dot-syncFromOutbound()]] - `calls` [INFERRED]
- [[AuthPrincipal]] - `references` [EXTRACTED]
- [[OutboundService]] - `method` [EXTRACTED]
- [[UpdateShippingDetailsDto]] - `references` [EXTRACTED]
- [[adminOutboundListItem()]] - `calls` [EXTRACTED]
- [[assertShippingIntentReady()]] - `calls` [EXTRACTED]
- [[calculateOrderVolume]] - `calls` [EXTRACTED]
- [[calculateOrderWeight]] - `calls` [EXTRACTED]
- [[composeDestinationAddress()]] - `calls` [EXTRACTED]
- [[shippingPackagesPrisma()]] - `calls` [EXTRACTED]
- [[shippingPrismaData()]] - `calls` [EXTRACTED]
- [[withTenantRls()]] - `calls` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/withTenantRls