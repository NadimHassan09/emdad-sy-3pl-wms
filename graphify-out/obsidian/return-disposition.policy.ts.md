---
source_file: "backend/src/modules/returns/return-disposition.policy.ts"
type: "code"
community: "returns.service.ts"
location: "L1"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/returnsservicets
---

# return-disposition.policy.ts

## Connections
- [[@nestjscommon]] - `imports_from` [EXTRACTED]
- [[@prismaclient]] - `imports_from` [EXTRACTED]
- [[INVENTORY_POSTING_DISPOSITIONS]] - `contains` [EXTRACTED]
- [[PENDING_INSPECTION_DISPOSITIONS]] - `contains` [EXTRACTED]
- [[assertLocationAllowedForDisposition()]] - `contains` [EXTRACTED]
- [[isAdjustmentStockLocationType()]] - `imports` [EXTRACTED]
- [[isInventoryPostingDisposition()]] - `contains` [EXTRACTED]
- [[isPendingInspectionDisposition()]] - `contains` [EXTRACTED]
- [[isQuarantineStorageLocationType()]] - `imports` [EXTRACTED]
- [[normalizeReturnDisposition()]] - `contains` [EXTRACTED]
- [[return-inventory.service.ts]] - `imports_from` [EXTRACTED]
- [[return-workflow.service.ts]] - `imports_from` [EXTRACTED]
- [[stockStatusForDisposition()]] - `contains` [EXTRACTED]
- [[storage-location-types.ts]] - `imports_from` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/returnsservicets