---
source_file: "backend/src/modules/shipping/shipping-tracking.service.ts"
type: "code"
community: "shipping-tracking.service.ts"
location: "L140"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/shipping-trackingservicets
---

# .processTrackingEvent()

## Connections
- [[dot-applyIncomingCancel()]] - `calls` [EXTRACTED]
- [[dot-applyVerifiedCarrierCost()]] - `calls` [EXTRACTED]
- [[dot-cancelUnconfirmedDraftReturns()]] - `calls` [INFERRED]
- [[dot-emitOmsOrderEvent()]] - `calls` [INFERRED]
- [[dot-handleCarrierDeliveredEvent()]] - `calls` [INFERRED]
- [[dot-handlePreDispatchCarrierFailure()]] - `calls` [EXTRACTED]
- [[dot-handleWebhook()]] - `calls` [INFERRED]
- [[dot-isPreOfd()]] - `calls` [EXTRACTED]
- [[dot-persistConfirmedSilaCourier()]] - `calls` [EXTRACTED]
- [[dot-persistSilaCarrierAwb()]] - `calls` [EXTRACTED]
- [[dot-persistUnconfirmedProviderLookup()]] - `calls` [EXTRACTED]
- [[dot-processCarrierReturnEvent()]] - `calls` [INFERRED]
- [[dot-syncShipmentByAwb()]] - `calls` [EXTRACTED]
- [[dot-syncUpdatedSince()]] - `calls` [INFERRED]
- [[dot-targetOmsStatus()]] - `calls` [EXTRACTED]
- [[NormalizedTrackingEvent]] - `references` [EXTRACTED]
- [[ShippingTrackingService]] - `method` [EXTRACTED]
- [[isProviderLookupNotFoundEvent()]] - `calls` [EXTRACTED]
- [[isSilaPendingCancelMeta()]] - `calls` [EXTRACTED]
- [[shipmentLookupOr()]] - `calls` [EXTRACTED]
- [[shouldApplyTrackingToOrder()]] - `calls` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/shipping-trackingservicets