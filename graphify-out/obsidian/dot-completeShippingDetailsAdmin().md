---
source_file: "backend/src/modules/outbound/outbound.service.ts"
type: "code"
community: "withTenantRls"
location: "L2140"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/withTenantRls
---

# .completeShippingDetailsAdmin()

## Connections
- [[dot-completeShippingDetails()]] - `calls` [INFERRED]
- [[dot-completeShippingDetailsBulk()]] - `calls` [INFERRED]
- [[dot-confirmReadyToShip()]] - `calls` [INFERRED]
- [[dot-emitOutboundOrderUpdated()]] - `calls` [INFERRED]
- [[dot-enqueueDispatchTaskIfNeeded()]] - `calls` [INFERRED]
- [[dot-executeAdmin()_3]] - `calls` [EXTRACTED]
- [[dot-findById()_16]] - `calls` [EXTRACTED]
- [[dot-findByIdForAdminStage()]] - `calls` [EXTRACTED]
- [[dot-processShippingDetailsItem()]] - `calls` [INFERRED]
- [[dot-record()]] - `calls` [INFERRED]
- [[dot-selectShippingMethodAdmin()]] - `calls` [EXTRACTED]
- [[dot-syncFromOutbound()]] - `calls` [INFERRED]
- [[AuthPrincipal]] - `references` [EXTRACTED]
- [[OutboundService]] - `method` [EXTRACTED]
- [[adminOutboundListItem()]] - `calls` [EXTRACTED]
- [[assertOutboundAdminStageAction()]] - `calls` [EXTRACTED]
- [[manualShippingConfirmNeedsMethodStep()]] - `calls` [EXTRACTED]
- [[outboundRequiresPacking()]] - `calls` [EXTRACTED]
- [[parseOutboundExecutionPlan()]] - `calls` [EXTRACTED]
- [[withTenantRls()]] - `calls` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/withTenantRls