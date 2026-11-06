---
source_file: "backend/src/modules/returns/returns.service.ts"
type: "code"
community: "returns.service.ts"
location: "L1"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/returnsservicets
---

# returns.service.ts

## Connections
- [[@nestjscommon]] - `imports_from` [EXTRACTED]
- [[@prismaclient]] - `imports_from` [EXTRACTED]
- [[ApplyReturnDispositionDto]] - `imports` [EXTRACTED]
- [[AuditLogService]] - `imports` [EXTRACTED]
- [[AuthPrincipal]] - `imports` [EXTRACTED]
- [[CompanyAccessService]] - `imports` [EXTRACTED]
- [[CreateReturnOrderDto]] - `imports` [EXTRACTED]
- [[InspectReturnLineDto]] - `imports` [EXTRACTED]
- [[InvalidStateException]] - `imports` [EXTRACTED]
- [[ListReturnOrdersQueryDto]] - `imports` [EXTRACTED]
- [[ORDER_INCLUDE_4]] - `contains` [EXTRACTED]
- [[OmsReturnsService]] - `imports` [EXTRACTED]
- [[PrismaService]] - `imports` [EXTRACTED]
- [[RealtimeService]] - `imports` [EXTRACTED]
- [[ReceiveReturnLineDto]] - `imports` [EXTRACTED]
- [[ReturnQuantityValidation]] - `imports` [EXTRACTED]
- [[ReturnWorkflowService]] - `imports` [EXTRACTED]
- [[ReturnsService]] - `contains` [EXTRACTED]
- [[apply-return-disposition.dto.ts]] - `imports_from` [EXTRACTED]
- [[assert-product-orderable.ts]] - `imports_from` [EXTRACTED]
- [[assertDiscreteUomPositiveIntegerQuantity()]] - `imports` [EXTRACTED]
- [[assertProductOrderableForOrders()]] - `imports` [EXTRACTED]
- [[assertUniqueReturnLineBuckets()]] - `imports` [EXTRACTED]
- [[audit-log.service.ts]] - `imports_from` [EXTRACTED]
- [[buildReturnListSummary()]] - `imports` [EXTRACTED]
- [[client-returns.service.ts]] - `imports_from` [EXTRACTED]
- [[company-access.service.ts]] - `imports_from` [EXTRACTED]
- [[company-read-scope.ts]] - `imports_from` [EXTRACTED]
- [[create-return-order.dto.ts]] - `imports_from` [EXTRACTED]
- [[current-user.types.ts]] - `imports_from` [EXTRACTED]
- [[discrete-uom-quantity.ts]] - `imports_from` [EXTRACTED]
- [[domain-exceptions.ts]] - `imports_from` [EXTRACTED]
- [[inspect-return-line.dto.ts]] - `imports_from` [EXTRACTED]
- [[isReturnCompletable()]] - `imports` [EXTRACTED]
- [[isReturnConfirmable()]] - `imports` [EXTRACTED]
- [[isReturnReceivable()]] - `imports` [EXTRACTED]
- [[isReturnTerminal()]] - `imports` [EXTRACTED]
- [[list-return-orders-query.dto.ts]] - `imports_from` [EXTRACTED]
- [[lockOutboundOrderRow()]] - `imports` [EXTRACTED]
- [[oms-returns.service.ts]] - `imports_from` [EXTRACTED]
- [[outbound-confirm-lock.util.ts]] - `imports_from` [EXTRACTED]
- [[prisma.service.ts]] - `imports_from` [EXTRACTED]
- [[readCompanyIdFilterRequired()]] - `imports` [EXTRACTED]
- [[realtime-ops.payload.ts]] - `imports_from` [EXTRACTED]
- [[realtime.service.ts]] - `imports_from` [EXTRACTED]
- [[receive-return-line.dto.ts]] - `imports_from` [EXTRACTED]
- [[return-line-integrity.util.ts]] - `imports_from` [EXTRACTED]
- [[return-quantity.validation.ts]] - `imports_from` [EXTRACTED]
- [[return-workflow.service.ts]] - `imports_from` [EXTRACTED]
- [[returnDetailPayload()]] - `imports` [EXTRACTED]
- [[returnListItemPayload()]] - `imports` [EXTRACTED]
- [[returns-list.service.unit.spec.ts]] - `imports_from` [EXTRACTED]
- [[returns.constants.ts]] - `imports_from` [EXTRACTED]
- [[returns.controller.ts]] - `imports_from` [EXTRACTED]
- [[returns.module.ts]] - `imports_from` [EXTRACTED]
- [[tenant-rls.ts]] - `imports_from` [EXTRACTED]
- [[withTenantRls()]] - `imports` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/returnsservicets