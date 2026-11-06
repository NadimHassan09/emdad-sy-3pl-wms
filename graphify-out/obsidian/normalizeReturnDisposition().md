---
source_file: "backend/src/modules/returns/return-disposition.policy.ts"
type: "code"
community: "returns.service.ts"
location: "L37"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/returnsservicets
---

# normalizeReturnDisposition()

## Connections
- [[dot-applyDisposition()]] - `calls` [EXTRACTED]
- [[dot-applyLineInventory()]] - `calls` [EXTRACTED]
- [[dot-inspectLine()_1]] - `calls` [EXTRACTED]
- [[dot-movementTypeForDisposition()]] - `calls` [EXTRACTED]
- [[assertLocationAllowedForDisposition()]] - `calls` [EXTRACTED]
- [[return-disposition.policy.ts]] - `contains` [EXTRACTED]
- [[return-inventory.service.ts]] - `imports` [EXTRACTED]
- [[return-workflow.service.ts]] - `imports` [EXTRACTED]
- [[stockStatusForDisposition()]] - `calls` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/returnsservicets