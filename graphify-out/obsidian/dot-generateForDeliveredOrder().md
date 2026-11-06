---
source_file: "backend/src/modules/cod/cod-records.service.ts"
type: "code"
community: "CodController"
location: "L322"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/CodController
---

# .generateForDeliveredOrder()

## Connections
- [[dot-handleCarrierDeliveredEvent()]] - `calls` [INFERRED]
- [[dot-markDelivered()]] - `calls` [INFERRED]
- [[dot-recordEvent()]] - `calls` [EXTRACTED]
- [[dot-retryGeneration()]] - `calls` [EXTRACTED]
- [[dot-validateResourceOwnership()]] - `calls` [INFERRED]
- [[AuthPrincipal]] - `references` [EXTRACTED]
- [[CodRecordsService]] - `method` [EXTRACTED]
- [[InvalidStateException]] - `calls` [EXTRACTED]
- [[serialize()]] - `calls` [EXTRACTED]
- [[withTenantRls()]] - `calls` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/CodController