---
source_file: "backend/src/modules/inbound/inbound.service.ts"
type: "code"
community: ".fromPrincipal"
location: "L787"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/fromPrincipal
---

# .confirm()

## Connections
- [[dot-approveAdmin()]] - `calls` [EXTRACTED]
- [[dot-confirm()]] - `calls` [INFERRED]
- [[dot-dismissPendingAdminNotifications()]] - `calls` [INFERRED]
- [[dot-emitInboundOrderUpdated()]] - `calls` [INFERRED]
- [[dot-findById()_14]] - `calls` [EXTRACTED]
- [[dot-fromPrincipal()]] - `calls` [INFERRED]
- [[dot-log()]] - `calls` [INFERRED]
- [[dot-logTx()]] - `calls` [INFERRED]
- [[dot-notifyClientOrderConfirmed()]] - `calls` [INFERRED]
- [[dot-startInboundWorkflowTx()]] - `calls` [INFERRED]
- [[dot-validateResourceOwnership()]] - `calls` [INFERRED]
- [[AuthPrincipal]] - `references` [EXTRACTED]
- [[ConfirmInboundBodyDto]] - `references` [EXTRACTED]
- [[InboundService]] - `method` [EXTRACTED]
- [[InvalidStateException]] - `calls` [EXTRACTED]
- [[adminInboundListItem()]] - `calls` [EXTRACTED]
- [[assertInboundAdminPlanComplete()]] - `calls` [EXTRACTED]
- [[assertProductOrderableForOrders()]] - `calls` [EXTRACTED]
- [[isInboundConfirmable()]] - `calls` [EXTRACTED]
- [[parseInboundExecutionPlan()]] - `calls` [EXTRACTED]
- [[setTenantRlsContext()]] - `calls` [EXTRACTED]
- [[taskOnlyFlows()]] - `calls` [EXTRACTED]
- [[withTenantRls()]] - `calls` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/fromPrincipal