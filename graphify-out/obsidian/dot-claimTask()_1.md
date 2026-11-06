---
source_file: "backend/src/modules/cycle-count/cycle-count-execution.service.ts"
type: "code"
community: "CycleCountExecutionService"
location: "L104"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/CycleCountExecutionService
---

# .claimTask()

## Connections
- [[dot-claimTask()]] - `calls` [INFERRED]
- [[dot-publishRealtimeUpdate()]] - `calls` [INFERRED]
- [[dot-requireWorkerId()]] - `calls` [EXTRACTED]
- [[dot-validateResourceOwnership()]] - `calls` [INFERRED]
- [[dot-workerCanAccessCount()]] - `calls` [EXTRACTED]
- [[AuthPrincipal]] - `references` [EXTRACTED]
- [[CycleCountExecutionService]] - `method` [EXTRACTED]
- [[InvalidStateException]] - `calls` [EXTRACTED]
- [[presentBlindCycleCountTask()]] - `calls` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/CycleCountExecutionService