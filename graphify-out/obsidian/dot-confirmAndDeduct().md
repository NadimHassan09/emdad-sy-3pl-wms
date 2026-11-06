---
source_file: "backend/src/modules/outbound/outbound.service.ts"
type: "code"
community: ".fromPrincipal"
location: "L2545"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/fromPrincipal
---

# .confirmAndDeduct()

## Connections
- [[dot-approveAdmin()_1]] - `calls` [EXTRACTED]
- [[dot-confirm()_3]] - `calls` [INFERRED]
- [[dot-confirmWithoutDeduction()]] - `calls` [EXTRACTED]
- [[dot-deductOutboundOrderLines()]] - `calls` [EXTRACTED]
- [[dot-dismissPendingAdminNotifications()]] - `calls` [INFERRED]
- [[dot-emitInventoryChanged()]] - `calls` [INFERRED]
- [[dot-emitOutboundOrderUpdated()]] - `calls` [INFERRED]
- [[dot-fromPrincipal()]] - `calls` [INFERRED]
- [[dot-gateConfirmTransaction()]] - `calls` [EXTRACTED]
- [[dot-log()]] - `calls` [INFERRED]
- [[dot-notifyClientOrderCompleted()]] - `calls` [INFERRED]
- [[dot-notifyClientOrderConfirmed()]] - `calls` [INFERRED]
- [[dot-processBulk()]] - `calls` [INFERRED]
- [[dot-recalculateForCompany()]] - `calls` [INFERRED]
- [[dot-startOutboundWorkflowTx()]] - `calls` [INFERRED]
- [[dot-syncFromOutbound()]] - `calls` [INFERRED]
- [[dot-tryAllocateOnConfirm()]] - `calls` [EXTRACTED]
- [[dot-validateResourceOwnership()]] - `calls` [INFERRED]
- [[AuthPrincipal]] - `references` [EXTRACTED]
- [[ConfirmOutboundBodyDto]] - `references` [EXTRACTED]
- [[InvalidStateException]] - `calls` [EXTRACTED]
- [[OutboundService]] - `method` [EXTRACTED]
- [[adminOutboundListItem()]] - `calls` [EXTRACTED]
- [[assertOutboundAdminPlanComplete()]] - `calls` [EXTRACTED]
- [[claimOutboundConfirmableOrder()]] - `calls` [EXTRACTED]
- [[finalizeOutboundShipped()]] - `calls` [EXTRACTED]
- [[outboundConfirmDefersDeduction()]] - `calls` [EXTRACTED]
- [[parseOutboundExecutionPlan()]] - `calls` [EXTRACTED]
- [[setTenantRlsContext()]] - `calls` [EXTRACTED]
- [[taskOnlyFlows()]] - `calls` [EXTRACTED]
- [[withTenantRls()]] - `calls` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/fromPrincipal