---
source_file: "backend/src/modules/outbound/outbound.service.ts"
type: "code"
community: ".fromPrincipal"
location: "L2468"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/fromPrincipal
---

# .confirmWithoutDeduction()

## Connections
- [[dot-confirmAndDeduct()]] - `calls` [EXTRACTED]
- [[dot-dismissPendingAdminNotifications()]] - `calls` [INFERRED]
- [[dot-emitOutboundOrderUpdated()]] - `calls` [INFERRED]
- [[dot-fromPrincipal()]] - `calls` [INFERRED]
- [[dot-gateConfirmTransaction()]] - `calls` [EXTRACTED]
- [[dot-log()]] - `calls` [INFERRED]
- [[dot-notifyClientOrderConfirmed()]] - `calls` [INFERRED]
- [[dot-syncFromOutbound()]] - `calls` [INFERRED]
- [[dot-tryAllocateOnConfirm()]] - `calls` [EXTRACTED]
- [[dot-validateResourceOwnership()]] - `calls` [INFERRED]
- [[AuthPrincipal]] - `references` [EXTRACTED]
- [[OutboundService]] - `method` [EXTRACTED]
- [[adminOutboundListItem()]] - `calls` [EXTRACTED]
- [[claimOutboundConfirmableOrder()]] - `calls` [EXTRACTED]
- [[setTenantRlsContext()]] - `calls` [EXTRACTED]
- [[withTenantRls()]] - `calls` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/fromPrincipal