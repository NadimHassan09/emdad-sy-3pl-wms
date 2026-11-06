---
source_file: "backend/src/modules/oms-returns/oms-returns.service.ts"
type: "code"
community: ".validateResourceOwnership"
location: "L1872"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/validateResourceOwnership
---

# .prepareNormalReturnImport()

## Connections
- [[dot-importNormalReturns()]] - `calls` [EXTRACTED]
- [[dot-sumActiveReturnedQtyByProduct()]] - `calls` [EXTRACTED]
- [[dot-validateNormalReturnImport()]] - `calls` [EXTRACTED]
- [[dot-validateResourceOwnership()]] - `calls` [INFERRED]
- [[AuthPrincipal]] - `references` [EXTRACTED]
- [[ImportOmsReturnsDto]] - `references` [EXTRACTED]
- [[OmsReturnsService]] - `method` [EXTRACTED]
- [[aggregateNormalReturnRows()]] - `calls` [EXTRACTED]
- [[expressReturnStatusRejectReason()]] - `calls` [EXTRACTED]
- [[isOmsReturnEligibleStatus()_1]] - `calls` [EXTRACTED]
- [[resolveExpressReturnOrder()]] - `calls` [EXTRACTED]
- [[resolveProductOnOrderLines()]] - `calls` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/validateResourceOwnership