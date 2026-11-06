---
source_file: "backend/src/modules/returns/return-workflow.service.ts"
type: "code"
community: "returns.service.ts"
location: "L123"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/returnsservicets
---

# .applyDisposition()

## Connections
- [[dot-applyDisposition()_2]] - `calls` [INFERRED]
- [[dot-applyLineInventory()]] - `calls` [INFERRED]
- [[dot-emitInventoryChanged()]] - `calls` [INFERRED]
- [[dot-fromPrincipal()]] - `calls` [INFERRED]
- [[dot-loadOrder()]] - `calls` [EXTRACTED]
- [[dot-logTx()]] - `calls` [INFERRED]
- [[dot-postAllEligibleLines()]] - `calls` [EXTRACTED]
- [[ApplyReturnDispositionDto]] - `references` [EXTRACTED]
- [[AuthPrincipal]] - `references` [EXTRACTED]
- [[InvalidStateException]] - `calls` [EXTRACTED]
- [[ReturnWorkflowService]] - `method` [EXTRACTED]
- [[isInventoryPostingDisposition()]] - `calls` [EXTRACTED]
- [[isPendingInspectionDisposition()]] - `calls` [EXTRACTED]
- [[isReturnInventoryApplicable()]] - `calls` [EXTRACTED]
- [[normalizeReturnDisposition()]] - `calls` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/returnsservicets