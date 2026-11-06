---
source_file: "backend/src/modules/oms-returns/normal-return-import.ts"
type: "code"
community: ".validateResourceOwnership"
location: "L1"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/validateResourceOwnership
---

# normal-return-import.ts

## Connections
- [[AggregatedReturnLine]] - `contains` [EXTRACTED]
- [[NormalReturnImportRow]] - `contains` [EXTRACTED]
- [[aggregateNormalReturnRows()]] - `contains` [EXTRACTED]
- [[looksLikeProductUuid()]] - `contains` [EXTRACTED]
- [[normal-return-import-validate.unit.spec.ts]] - `imports_from` [EXTRACTED]
- [[normal-return-import.unit.spec.ts]] - `imports_from` [EXTRACTED]
- [[oms-returns.service.ts]] - `imports_from` [EXTRACTED]
- [[resolveProductOnOrderLines()]] - `contains` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/validateResourceOwnership