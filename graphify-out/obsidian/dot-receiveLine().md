---
source_file: "backend/src/modules/inbound/inbound.service.ts"
type: "code"
community: "outbound.service.ts"
location: "L1014"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/outboundservicets
---

# .receiveLine()

## Connections
- [[dot-emitInboundOrderUpdated()]] - `calls` [INFERRED]
- [[dot-emitInventoryChanged()]] - `calls` [INFERRED]
- [[dot-isDockStagingLocationType()]] - `calls` [EXTRACTED]
- [[dot-receive()]] - `calls` [INFERRED]
- [[dot-refreshInboundOrderHeadStatus()]] - `calls` [EXTRACTED]
- [[dot-upsertPositive()]] - `calls` [INFERRED]
- [[dot-validateResourceOwnership()]] - `calls` [INFERRED]
- [[AuthPrincipal]] - `references` [EXTRACTED]
- [[InboundService]] - `method` [EXTRACTED]
- [[InvalidLocationTypeException]] - `calls` [EXTRACTED]
- [[InvalidStateException]] - `calls` [EXTRACTED]
- [[LotLockedException]] - `calls` [EXTRACTED]
- [[LotRequiredException]] - `calls` [EXTRACTED]
- [[ReceiveLineDto]] - `references` [EXTRACTED]
- [[adminInboundListItem()]] - `calls` [EXTRACTED]
- [[assertDiscreteUomPositiveIntegerQuantity()]] - `calls` [EXTRACTED]
- [[assertLocationUsableForInventoryMove()]] - `calls` [EXTRACTED]
- [[assertProductOrderableForOrders()]] - `calls` [EXTRACTED]
- [[assertReceivingQuantitiesWithinExpected()]] - `calls` [EXTRACTED]
- [[inboundReceiveDefersPutaway()]] - `calls` [EXTRACTED]
- [[isStorageLocationType()]] - `calls` [EXTRACTED]
- [[setTenantRlsContext()]] - `calls` [EXTRACTED]
- [[taskOnlyFlows()]] - `calls` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/outboundservicets