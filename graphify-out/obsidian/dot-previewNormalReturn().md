---
source_file: "backend/src/modules/oms-returns/oms-returns.service.ts"
type: "code"
community: ".validateResourceOwnership"
location: "L1768"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/validateResourceOwnership
---

# .previewNormalReturn()

## Connections
- [[dot-preview()_1]] - `calls` [INFERRED]
- [[dot-sumActiveReturnedQtyByProduct()]] - `calls` [EXTRACTED]
- [[dot-validateResourceOwnership()]] - `calls` [INFERRED]
- [[AuthPrincipal]] - `references` [EXTRACTED]
- [[InvalidStateException]] - `calls` [EXTRACTED]
- [[OmsReturnsService]] - `method` [EXTRACTED]
- [[PreviewOmsReturnDto]] - `references` [EXTRACTED]
- [[expressReturnStatusRejectReason()]] - `calls` [EXTRACTED]
- [[isOmsReturnEligibleStatus()_1]] - `calls` [EXTRACTED]
- [[resolveExpressReturnOrder()]] - `calls` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/validateResourceOwnership