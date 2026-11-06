---
source_file: "backend/src/modules/shipping/shipping-lifecycle.util.ts"
type: "code"
community: "shipping-tracking.service.ts"
location: "L1"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/shipping-trackingservicets
---

# shipping-lifecycle.util.ts

## Connections
- [[@prismaclient]] - `imports_from` [EXTRACTED]
- [[ACTIVE_CARRIER_SHIPMENT_WHERE]] - `contains` [EXTRACTED]
- [[CarrierShipmentActivity]] - `contains` [EXTRACTED]
- [[ConfirmedCourier]] - `contains` [EXTRACTED]
- [[INACTIVE_CARRIER_SHIPMENT_STATUSES]] - `contains` [EXTRACTED]
- [[PRE_DISPATCH_UNLOCK_OMS]] - `contains` [EXTRACTED]
- [[TERMINAL_NO_UNLOCK_OMS]] - `contains` [EXTRACTED]
- [[carrierUnlinkPatch()]] - `contains` [EXTRACTED]
- [[confirmedCourierReassignment()]] - `contains` [EXTRACTED]
- [[hubIdFromFingerprint()]] - `contains` [EXTRACTED]
- [[isActiveCarrierShipment()]] - `contains` [EXTRACTED]
- [[isAwbPendingReassignment()]] - `contains` [EXTRACTED]
- [[isSilaPendingCancelMeta()]] - `contains` [EXTRACTED]
- [[mayUnlockToShippingDetails()]] - `contains` [EXTRACTED]
- [[normalizeCourierDisplayName()]] - `imports` [EXTRACTED]
- [[normalizeWaybillScanCode()]] - `contains` [EXTRACTED]
- [[oms-order.mapper.ts]] - `imports_from` [EXTRACTED]
- [[oms-orders.service.ts]] - `imports_from` [EXTRACTED]
- [[oms-returns.service.ts]] - `imports_from` [EXTRACTED]
- [[oms-shipping-scan.service.ts]] - `imports_from` [EXTRACTED]
- [[oms-waybill.service.ts]] - `imports_from` [EXTRACTED]
- [[oms-waybill.service.unit.spec.ts]] - `imports_from` [EXTRACTED]
- [[omsoms-operational-stage.ts]] - `imports_from` [EXTRACTED]
- [[omsStatusAfterPreDispatchUnlock()]] - `contains` [EXTRACTED]
- [[outboundStatusAfterPreDispatchUnlock()]] - `contains` [EXTRACTED]
- [[pickActiveCarrierShipment()]] - `contains` [EXTRACTED]
- [[requireHubSelection()]] - `contains` [EXTRACTED]
- [[shipmentScanValues()]] - `contains` [EXTRACTED]
- [[shipmentSendGuard()]] - `contains` [EXTRACTED]
- [[shipping-carrier-resolver.ts]] - `imports_from` [EXTRACTED]
- [[shipping-lifecycle.util.unit.spec.ts]] - `imports_from` [EXTRACTED]
- [[shipping-tracking.service.ts]] - `imports_from` [EXTRACTED]
- [[shouldApplyTrackingToOrder()]] - `contains` [EXTRACTED]
- [[waybillScanAttempts()_1]] - `contains` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/shipping-trackingservicets