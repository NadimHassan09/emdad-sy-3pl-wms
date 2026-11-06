---
source_file: "backend/src/modules/oms/oms-orders.service.ts"
type: "code"
community: "withTenantRls"
location: "L1940"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/withTenantRls
---

# .revertCancel()

## Connections
- [[dot-allocateOrder()]] - `calls` [INFERRED]
- [[dot-cancelRevert()]] - `calls` [INFERRED]
- [[dot-emitOms()]] - `calls` [EXTRACTED]
- [[dot-hasActiveReservations()]] - `calls` [INFERRED]
- [[dot-listForOrderTx()]] - `calls` [INFERRED]
- [[dot-record()]] - `calls` [INFERRED]
- [[dot-resolveOrder()]] - `calls` [EXTRACTED]
- [[dot-revertCancel()]] - `calls` [INFERRED]
- [[dot-validateResourceOwnership()]] - `calls` [INFERRED]
- [[AuthPrincipal]] - `references` [EXTRACTED]
- [[InvalidStateException]] - `calls` [EXTRACTED]
- [[OmsOrdersService]] - `method` [EXTRACTED]
- [[assertOmsCancelRevert()]] - `calls` [EXTRACTED]
- [[assertPreviousOmsStatusOrThrow()]] - `calls` [EXTRACTED]
- [[clientMayRevertTo()]] - `calls` [EXTRACTED]
- [[needsReallocation()]] - `calls` [EXTRACTED]
- [[parseOutboundStatus()]] - `calls` [EXTRACTED]
- [[resolveOmsActorRole()]] - `calls` [EXTRACTED]
- [[resolveOutboundRestoreStatus()]] - `calls` [EXTRACTED]
- [[resolvePreviousOmsStatus()]] - `calls` [EXTRACTED]
- [[serializeOmsOrder()]] - `calls` [EXTRACTED]
- [[withTenantRls()]] - `calls` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/withTenantRls