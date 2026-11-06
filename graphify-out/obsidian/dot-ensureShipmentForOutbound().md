---
source_file: "backend/src/modules/shipping/shipping.service.ts"
type: "code"
community: "shipping.service.ts"
location: "L1050"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/shippingservicets
---

# .ensureShipmentForOutbound()

## Connections
- [[dot-claimPendingShipment()]] - `calls` [EXTRACTED]
- [[dot-decrypt()]] - `calls` [INFERRED]
- [[dot-emitOutboundShippingUpdate()]] - `calls` [EXTRACTED]
- [[dot-failClaim()]] - `calls` [EXTRACTED]
- [[dot-get()_1]] - `calls` [INFERRED]
- [[dot-getConfiguredPickupParty()]] - `calls` [EXTRACTED]
- [[dot-onReadyForShipping()]] - `calls` [INFERRED]
- [[dot-persistCreatedFromExistingAwb()]] - `calls` [EXTRACTED]
- [[dot-persistFailedShipment()]] - `calls` [EXTRACTED]
- [[dot-processItem()]] - `calls` [INFERRED]
- [[dot-requireProvider()]] - `calls` [EXTRACTED]
- [[dot-resolveBabelNeighbourhoodId()]] - `calls` [EXTRACTED]
- [[dot-resolveFromAddress()]] - `calls` [INFERRED]
- [[dot-resolveReceiverCoordinatesFromAddress()]] - `calls` [EXTRACTED]
- [[dot-retryShipment()]] - `calls` [EXTRACTED]
- [[dot-sendShippingDetails()]] - `calls` [INFERRED]
- [[dot-usableRate()]] - `calls` [INFERRED]
- [[ShippingService]] - `method` [EXTRACTED]
- [[assertCarrierShippingReady()]] - `calls` [EXTRACTED]
- [[babelPartsFromCartons()]] - `calls` [EXTRACTED]
- [[buildPhysicalShipmentParts()]] - `calls` [EXTRACTED]
- [[classifyShippingError()]] - `calls` [EXTRACTED]
- [[composeDestinationAddress()]] - `calls` [EXTRACTED]
- [[confirmedCarrierIdentityPatch()]] - `calls` [EXTRACTED]
- [[confirmedServiceIdForProvider()]] - `calls` [EXTRACTED]
- [[leftoverAwbCompatibleWithProvider()]] - `calls` [EXTRACTED]
- [[mayCreateShipment()]] - `calls` [EXTRACTED]
- [[parsePhoneForBabel()]] - `calls` [EXTRACTED]
- [[parseShippingCartons()]] - `calls` [EXTRACTED]
- [[phoneTail()]] - `calls` [EXTRACTED]
- [[preflightCarrierShipment()]] - `calls` [EXTRACTED]
- [[resolveBabelCodCurrency()]] - `calls` [EXTRACTED]
- [[resolveCollectionForService()]] - `calls` [EXTRACTED]
- [[safeErrorMessage()]] - `calls` [EXTRACTED]
- [[toBabelWeightParts()]] - `calls` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/shippingservicets