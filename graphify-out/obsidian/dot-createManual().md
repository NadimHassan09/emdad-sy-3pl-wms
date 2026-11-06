---
source_file: "backend/src/modules/cycle-count/cycle-count.service.ts"
type: "code"
community: "CycleCountService"
location: "L144"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/CycleCountService
---

# .createManual()

## Connections
- [[dot-assertNoActiveCount()]] - `calls` [EXTRACTED]
- [[dot-assertWarehouse()]] - `calls` [EXTRACTED]
- [[dot-assertWorkerForWarehouse()]] - `calls` [EXTRACTED]
- [[dot-buildSnapshotRows()]] - `calls` [INFERRED]
- [[dot-createCount()]] - `calls` [INFERRED]
- [[dot-emitCycleCountEvent()]] - `calls` [EXTRACTED]
- [[dot-fromPrincipal()]] - `calls` [INFERRED]
- [[dot-insertLines()]] - `calls` [INFERRED]
- [[dot-logTx()]] - `calls` [INFERRED]
- [[dot-resolveWriteCompanyId()]] - `calls` [INFERRED]
- [[AuthPrincipal]] - `references` [EXTRACTED]
- [[CreateCycleCountDto]] - `references` [EXTRACTED]
- [[CycleCountService]] - `method` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/CycleCountService