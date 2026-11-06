---
source_file: "backend/src/modules/shipping/shipping-carrier-resolver.ts"
type: "code"
community: "shipping-tracking.service.ts"
location: "L120"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/shipping-trackingservicets
---

# resolveShippingCarrierName()

## Connections
- [[dot-cancelCarrierShipmentForOrder()]] - `calls` [EXTRACTED]
- [[dot-exportWaybillsExcel()_1]] - `calls` [EXTRACTED]
- [[dot-finalizeTrackingHistoryIdentity()]] - `calls` [EXTRACTED]
- [[dot-getShippingMovement()_1]] - `calls` [EXTRACTED]
- [[dot-getWaybillData()]] - `calls` [EXTRACTED]
- [[confirmedCarrierDisplayName()]] - `calls` [EXTRACTED]
- [[courierNameFromMeta()]] - `calls` [EXTRACTED]
- [[displayNameForProviderCode()]] - `calls` [EXTRACTED]
- [[isProviderName()]] - `calls` [EXTRACTED]
- [[nameFromCourierId()]] - `calls` [EXTRACTED]
- [[normalizeCourierDisplayName()]] - `calls` [EXTRACTED]
- [[oms-order.mapper.ts]] - `imports` [EXTRACTED]
- [[oms-orders.service.ts]] - `imports` [EXTRACTED]
- [[oms-waybill.service.ts]] - `imports` [EXTRACTED]
- [[serializeOmsOrder()]] - `calls` [EXTRACTED]
- [[serializeOmsOrderListItem()]] - `calls` [EXTRACTED]
- [[shipping-carrier-resolver.ts]] - `contains` [EXTRACTED]
- [[shipping-carrier-resolver.unit.spec.ts]] - `imports` [EXTRACTED]
- [[shipping-tracking.service.ts]] - `imports` [EXTRACTED]
- [[shipping.service.ts]] - `imports` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/shipping-trackingservicets