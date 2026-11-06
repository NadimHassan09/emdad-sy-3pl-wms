---
source_file: "backend/src/modules/oms-returns/oms-returns.service.ts"
type: "code"
community: ".validateResourceOwnership"
location: "L2236"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/validateResourceOwnership
---

# .validateOrdersForExpressReturn()

## Connections
- [[dot-sumActiveReturnedQtyByProduct()]] - `calls` [EXTRACTED]
- [[dot-validateExpressReturn()]] - `calls` [INFERRED]
- [[dot-validateResourceOwnership()]] - `calls` [INFERRED]
- [[AuthPrincipal]] - `references` [EXTRACTED]
- [[OmsReturnsService]] - `method` [EXTRACTED]
- [[dedupeExpressReturnInputs()]] - `calls` [EXTRACTED]
- [[expressReturnStatusRejectReason()]] - `calls` [EXTRACTED]
- [[isOmsReturnEligibleStatus()_1]] - `calls` [EXTRACTED]
- [[resolveExpressReturnOrder()]] - `calls` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/validateResourceOwnership