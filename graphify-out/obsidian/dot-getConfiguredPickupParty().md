---
source_file: "backend/src/modules/shipping/shipping.service.ts"
type: "code"
community: "shipping.service.ts"
location: "L378"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/shippingservicets
---

# .getConfiguredPickupParty()

## Connections
- [[dot-ensureShipmentForOutbound()]] - `calls` [EXTRACTED]
- [[dot-quoteDestinationRatesUncached()]] - `calls` [EXTRACTED]
- [[dot-reshipOutboundWithCarrier()]] - `calls` [EXTRACTED]
- [[dot-resolveNeighbourhoodId()]] - `calls` [INFERRED]
- [[dot-resolveReceiverCoordinatesFromAddress()]] - `calls` [EXTRACTED]
- [[dot-tryQuoteOrder()]] - `calls` [INFERRED]
- [[ShippingParty]] - `references` [EXTRACTED]
- [[ShippingService]] - `method` [EXTRACTED]
- [[parsePhoneForBabel()]] - `calls` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/shippingservicets