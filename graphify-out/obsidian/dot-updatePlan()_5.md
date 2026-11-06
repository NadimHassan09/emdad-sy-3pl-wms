---
source_file: "backend/src/modules/inbound/inbound.service.ts"
type: "code"
community: ".fromPrincipal"
location: "L540"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/fromPrincipal
---

# .updatePlan()

## Connections
- [[dot-findById()_14]] - `calls` [EXTRACTED]
- [[dot-updatePlan()]] - `calls` [INFERRED]
- [[AuthPrincipal]] - `references` [EXTRACTED]
- [[InboundService]] - `method` [EXTRACTED]
- [[InvalidStateException]] - `calls` [EXTRACTED]
- [[UpdateInboundPlanDto]] - `references` [EXTRACTED]
- [[assertCalendarDateNotBeforeToday()]] - `calls` [EXTRACTED]
- [[assertInboundAdminPlanComplete()]] - `calls` [EXTRACTED]
- [[isInboundPlanEditable()]] - `calls` [EXTRACTED]
- [[normalizeExecutionMode()_1]] - `calls` [EXTRACTED]
- [[parseInboundExecutionPlan()]] - `calls` [EXTRACTED]
- [[withTenantRls()]] - `calls` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/fromPrincipal