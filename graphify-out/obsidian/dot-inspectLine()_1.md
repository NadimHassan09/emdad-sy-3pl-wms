---
source_file: "backend/src/modules/returns/return-workflow.service.ts"
type: "code"
community: "returns.service.ts"
location: "L54"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/returnsservicets
---

# .inspectLine()

## Connections
- [[dot-fromPrincipal()]] - `calls` [INFERRED]
- [[dot-inspectLine()]] - `calls` [INFERRED]
- [[dot-loadOrder()]] - `calls` [EXTRACTED]
- [[dot-logTx()]] - `calls` [INFERRED]
- [[dot-syncOrderWorkflowStatus()]] - `calls` [EXTRACTED]
- [[AuthPrincipal]] - `references` [EXTRACTED]
- [[InspectReturnLineDto]] - `references` [EXTRACTED]
- [[InvalidStateException]] - `calls` [EXTRACTED]
- [[ReturnWorkflowService]] - `method` [EXTRACTED]
- [[isReturnInspectable()]] - `calls` [EXTRACTED]
- [[normalizeReturnDisposition()]] - `calls` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/returnsservicets