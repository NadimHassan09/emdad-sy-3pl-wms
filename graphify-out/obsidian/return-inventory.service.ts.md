---
source_file: "backend/src/modules/returns/return-inventory.service.ts"
type: "code"
community: "returns.service.ts"
location: "L1"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/returnsservicets
---

# return-inventory.service.ts

## Connections
- [[@nestjscommon]] - `imports_from` [EXTRACTED]
- [[@prismaclient]] - `imports_from` [EXTRACTED]
- [[LedgerIdempotencyService]] - `imports` [EXTRACTED]
- [[PrismaService]] - `imports` [EXTRACTED]
- [[ReturnInventoryService]] - `contains` [EXTRACTED]
- [[ReturnLineInventoryContext]] - `contains` [EXTRACTED]
- [[StockHelpers]] - `imports` [EXTRACTED]
- [[Tx_9]] - `contains` [EXTRACTED]
- [[assertLocationAllowedForDisposition()]] - `imports` [EXTRACTED]
- [[assertLocationUsableForInventoryMove()]] - `imports` [EXTRACTED]
- [[isInventoryPostingDisposition()]] - `imports` [EXTRACTED]
- [[ledger-idempotency.service.ts]] - `imports_from` [EXTRACTED]
- [[location-operational.ts]] - `imports_from` [EXTRACTED]
- [[normalizeReturnDisposition()]] - `imports` [EXTRACTED]
- [[prisma.service.ts]] - `imports_from` [EXTRACTED]
- [[return-disposition.policy.ts]] - `imports_from` [EXTRACTED]
- [[return-workflow.service.ts]] - `imports_from` [EXTRACTED]
- [[returns.module.ts]] - `imports_from` [EXTRACTED]
- [[stock.helpers.ts]] - `imports_from` [EXTRACTED]
- [[stockStatusForDisposition()]] - `imports` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/returnsservicets