---
source_file: "backend/src/modules/shipping/shipping-tracking.service.ts"
type: "code"
community: "shipping-tracking.service.ts"
location: "L1503"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/shipping-trackingservicets
---

# .applyConfirmedShipmentCancellation()

## Connections
- [[dot-cancelCarrierShipmentForOrder()]] - `calls` [EXTRACTED]
- [[dot-emitOmsOrderEvent()]] - `calls` [INFERRED]
- [[ShippingTrackingService]] - `method` [EXTRACTED]
- [[carrierUnlinkPatch()]] - `calls` [EXTRACTED]
- [[mergeShipmentRawMeta()]] - `calls` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/shipping-trackingservicets