---
source_file: "backend/src/modules/returns/return-workflow.service.ts"
type: "code"
community: "returns.service.ts"
location: "L1"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/returnsservicets
---

# return-workflow.service.ts

## Connections
- [[@nestjscommon]] - `imports_from` [EXTRACTED]
- [[@prismaclient]] - `imports_from` [EXTRACTED]
- [[ApplyReturnDispositionDto]] - `imports` [EXTRACTED]
- [[AuditLogService]] - `imports` [EXTRACTED]
- [[AuthPrincipal]] - `imports` [EXTRACTED]
- [[CompanyAccessService]] - `imports` [EXTRACTED]
- [[InspectReturnLineDto]] - `imports` [EXTRACTED]
- [[InvalidStateException]] - `imports` [EXTRACTED]
- [[ORDER_INCLUDE_3]] - `contains` [EXTRACTED]
- [[PrismaService]] - `imports` [EXTRACTED]
- [[RealtimeService]] - `imports` [EXTRACTED]
- [[ReturnInventoryService]] - `imports` [EXTRACTED]
- [[ReturnWorkflowService]] - `contains` [EXTRACTED]
- [[apply-return-disposition.dto.ts]] - `imports_from` [EXTRACTED]
- [[audit-log.service.ts]] - `imports_from` [EXTRACTED]
- [[company-access.service.ts]] - `imports_from` [EXTRACTED]
- [[current-user.types.ts]] - `imports_from` [EXTRACTED]
- [[domain-exceptions.ts]] - `imports_from` [EXTRACTED]
- [[inspect-return-line.dto.ts]] - `imports_from` [EXTRACTED]
- [[isInventoryPostingDisposition()]] - `imports` [EXTRACTED]
- [[isPendingInspectionDisposition()]] - `imports` [EXTRACTED]
- [[isReturnInspectable()]] - `imports` [EXTRACTED]
- [[isReturnInventoryApplicable()]] - `imports` [EXTRACTED]
- [[normalizeReturnDisposition()]] - `imports` [EXTRACTED]
- [[prisma.service.ts]] - `imports_from` [EXTRACTED]
- [[realtime.service.ts]] - `imports_from` [EXTRACTED]
- [[return-disposition.policy.ts]] - `imports_from` [EXTRACTED]
- [[return-inventory.service.ts]] - `imports_from` [EXTRACTED]
- [[returns.constants.ts]] - `imports_from` [EXTRACTED]
- [[returns.module.ts]] - `imports_from` [EXTRACTED]
- [[returns.service.ts]] - `imports_from` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/returnsservicets