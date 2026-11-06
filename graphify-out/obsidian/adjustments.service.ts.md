---
source_file: "backend/src/modules/adjustments/adjustments.service.ts"
type: "code"
community: "cycle-count.service.ts"
location: "L1"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/cycle-countservicets
---

# adjustments.service.ts

## Connections
- [[@nestjscommon]] - `imports_from` [EXTRACTED]
- [[@prismaclient]] - `imports_from` [EXTRACTED]
- [[ADJUSTMENT_DETAIL_INCLUDE]] - `contains` [EXTRACTED]
- [[ADJUSTMENT_REASON_PENDING_1]] - `imports` [EXTRACTED]
- [[AddAdjustmentLineDto]] - `imports` [EXTRACTED]
- [[AdjustmentsService]] - `contains` [EXTRACTED]
- [[ApproveAdjustmentOptions]] - `contains` [EXTRACTED]
- [[AuditLogService]] - `imports` [EXTRACTED]
- [[AuthPrincipal]] - `imports` [EXTRACTED]
- [[CompanyAccessService]] - `imports` [EXTRACTED]
- [[CreateAdjustmentDto]] - `imports` [EXTRACTED]
- [[InvalidStateException]] - `imports` [EXTRACTED]
- [[ListAdjustmentsQueryDto]] - `imports` [EXTRACTED]
- [[PatchAdjustmentDto]] - `imports` [EXTRACTED]
- [[PatchAdjustmentLineDto]] - `imports` [EXTRACTED]
- [[PrismaService]] - `imports` [EXTRACTED]
- [[RealtimeService]] - `imports` [EXTRACTED]
- [[StockHelpers]] - `imports` [EXTRACTED]
- [[add-adjustment-line.dto.ts]] - `imports_from` [EXTRACTED]
- [[adjustmentPayload()]] - `imports` [EXTRACTED]
- [[adjustments.controller.ts]] - `imports_from` [EXTRACTED]
- [[adjustments.module.ts]] - `imports_from` [EXTRACTED]
- [[assertDiscreteUomPositiveIntegerQuantity()]] - `imports` [EXTRACTED]
- [[assertLocationUsableForInventoryMove()]] - `imports` [EXTRACTED]
- [[audit-log.service.ts]] - `imports_from` [EXTRACTED]
- [[company-access.service.ts]] - `imports_from` [EXTRACTED]
- [[company-read-scope.ts]] - `imports_from` [EXTRACTED]
- [[create-adjustment.dto.ts]] - `imports_from` [EXTRACTED]
- [[current-user.types.ts]] - `imports_from` [EXTRACTED]
- [[cycle-count-variance.service.ts]] - `imports_from` [EXTRACTED]
- [[discrete-uom-quantity.ts]] - `imports_from` [EXTRACTED]
- [[domain-exceptions.ts]] - `imports_from` [EXTRACTED]
- [[isAdjustmentStockLocationType()]] - `imports` [EXTRACTED]
- [[list-adjustments-query.dto.ts]] - `imports_from` [EXTRACTED]
- [[location-operational.ts]] - `imports_from` [EXTRACTED]
- [[patch-adjustment-line.dto.ts]] - `imports_from` [EXTRACTED]
- [[patch-adjustment.dto.ts]] - `imports_from` [EXTRACTED]
- [[prisma.service.ts]] - `imports_from` [EXTRACTED]
- [[readCompanyIdFilterRequired()]] - `imports` [EXTRACTED]
- [[realtime-ops.payload.ts]] - `imports_from` [EXTRACTED]
- [[realtime.service.ts]] - `imports_from` [EXTRACTED]
- [[stock.helpers.ts]] - `imports_from` [EXTRACTED]
- [[storage-location-types.ts]] - `imports_from` [EXTRACTED]
- [[tenant-rls.ts]] - `imports_from` [EXTRACTED]
- [[withTenantRls()]] - `imports` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/cycle-countservicets