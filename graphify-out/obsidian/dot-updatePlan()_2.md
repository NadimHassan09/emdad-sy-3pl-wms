---
source_file: "backend/src/modules/oms-returns/oms-returns.service.ts"
type: "code"
community: ".validateResourceOwnership"
location: "L1118"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/validateResourceOwnership
---

# .updatePlan()

## Connections
- [[dot-approve()_4]] - `calls` [EXTRACTED]
- [[dot-autoCompleteReturn()]] - `calls` [EXTRACTED]
- [[dot-emitReturn()]] - `calls` [EXTRACTED]
- [[dot-updatePlan()_1]] - `calls` [INFERRED]
- [[dot-validateResourceOwnership()]] - `calls` [INFERRED]
- [[AuthPrincipal]] - `references` [EXTRACTED]
- [[InvalidStateException]] - `calls` [EXTRACTED]
- [[OmsReturnsService]] - `method` [EXTRACTED]
- [[UpdateOmsReturnPlanDto]] - `references` [EXTRACTED]
- [[assertInboundAdminPlanComplete()]] - `calls` [EXTRACTED]
- [[normalizeExecutionMode()_1]] - `calls` [EXTRACTED]
- [[parseInboundExecutionPlan()]] - `calls` [EXTRACTED]
- [[serialize()_1]] - `calls` [EXTRACTED]
- [[withTenantRls()]] - `calls` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/validateResourceOwnership