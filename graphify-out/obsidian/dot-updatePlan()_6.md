---
source_file: "backend/src/modules/outbound/outbound.service.ts"
type: "code"
community: "withTenantRls"
location: "L1002"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/withTenantRls
---

# .updatePlan()

## Connections
- [[dot-allocateOrder()]] - `calls` [INFERRED]
- [[dot-emitOutboundOrderUpdated()]] - `calls` [INFERRED]
- [[dot-ensureDefaultExecutionPlan()]] - `calls` [EXTRACTED]
- [[dot-findById()_16]] - `calls` [EXTRACTED]
- [[dot-hasActiveReservations()]] - `calls` [INFERRED]
- [[dot-isEnabled()_3]] - `calls` [INFERRED]
- [[dot-processBulk()]] - `calls` [INFERRED]
- [[dot-releaseAllocation()_2]] - `calls` [INFERRED]
- [[dot-updatePlan()_3]] - `calls` [INFERRED]
- [[AuthPrincipal]] - `references` [EXTRACTED]
- [[InvalidStateException]] - `calls` [EXTRACTED]
- [[OutboundService]] - `method` [EXTRACTED]
- [[UpdateOutboundPlanDto]] - `references` [EXTRACTED]
- [[adminOutboundListItem()]] - `calls` [EXTRACTED]
- [[assertCalendarDateNotBeforeToday()]] - `calls` [EXTRACTED]
- [[assertOutboundAdminPlanComplete()]] - `calls` [EXTRACTED]
- [[assertShippingConfigUnlocked()]] - `calls` [EXTRACTED]
- [[assertShippingIntentReady()]] - `calls` [EXTRACTED]
- [[hasShippingConfigPatch()]] - `calls` [EXTRACTED]
- [[isOutboundConfirmable()]] - `calls` [EXTRACTED]
- [[normalizeExecutionMode()_1]] - `calls` [EXTRACTED]
- [[parseOutboundExecutionPlan()]] - `calls` [EXTRACTED]
- [[resolveShippingVolumeCbm()]] - `calls` [EXTRACTED]
- [[resolveShippingWeightKg()]] - `calls` [EXTRACTED]
- [[shippingPrismaData()]] - `calls` [EXTRACTED]
- [[withTenantRls()]] - `calls` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/withTenantRls