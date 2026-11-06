---
source_file: "backend/src/modules/cycle-count/cycle-count-variance.service.ts"
type: "code"
community: "CycleCountService"
location: "L174"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/CycleCountService
---

# .buildReconciliationDraft()

## Connections
- [[dot-assertAllVariancesReviewed()]] - `calls` [EXTRACTED]
- [[dot-buildReconciliation()]] - `calls` [INFERRED]
- [[dot-emitAdjustmentCreated()]] - `calls` [INFERRED]
- [[dot-fromPrincipal()]] - `calls` [INFERRED]
- [[dot-logTx()]] - `calls` [INFERRED]
- [[dot-validateResourceOwnership()]] - `calls` [INFERRED]
- [[AuthPrincipal]] - `references` [EXTRACTED]
- [[CycleCountVarianceService]] - `method` [EXTRACTED]
- [[InvalidStateException]] - `calls` [EXTRACTED]
- [[adjustmentPayload()]] - `calls` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/CycleCountService