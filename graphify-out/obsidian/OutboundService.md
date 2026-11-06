---
source_file: "backend/src/modules/outbound/outbound.service.ts"
type: "code"
community: "withTenantRls"
location: "L250"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/withTenantRls
---

# OutboundService

## Connections
- [[dot-approveAdmin()_1]] - `method` [EXTRACTED]
- [[dot-assertImportCreateReady()_2]] - `method` [EXTRACTED]
- [[dot-assertSufficientStockForLines()_1]] - `method` [EXTRACTED]
- [[dot-buildListWhere()_1]] - `method` [EXTRACTED]
- [[dot-cancel()_14]] - `method` [EXTRACTED]
- [[dot-completeDispatchAdmin()]] - `method` [EXTRACTED]
- [[dot-completePackingAdmin()]] - `method` [EXTRACTED]
- [[dot-completePickingAdmin()]] - `method` [EXTRACTED]
- [[dot-completeShippingDetailsAdmin()]] - `method` [EXTRACTED]
- [[dot-confirmAndDeduct()]] - `method` [EXTRACTED]
- [[dot-confirmWithoutDeduction()]] - `method` [EXTRACTED]
- [[dot-constructor()_215]] - `references` [EXTRACTED]
- [[dot-constructor()_216]] - `references` [EXTRACTED]
- [[dot-constructor()_142]] - `references` [EXTRACTED]
- [[dot-constructor()_80]] - `references` [EXTRACTED]
- [[dot-constructor()_110]] - `references` [EXTRACTED]
- [[dot-constructor()_28]] - `references` [EXTRACTED]
- [[dot-constructor()_29]] - `references` [EXTRACTED]
- [[dot-constructor()_213]] - `references` [EXTRACTED]
- [[dot-constructor()_64]] - `references` [EXTRACTED]
- [[dot-constructor()_145]] - `method` [EXTRACTED]
- [[dot-create()_45]] - `method` [EXTRACTED]
- [[dot-deductOutboundOrderLines()]] - `method` [EXTRACTED]
- [[dot-ensureDefaultExecutionPlan()]] - `method` [EXTRACTED]
- [[dot-ensurePickingFollowups()]] - `method` [EXTRACTED]
- [[dot-executeAdmin()_3]] - `method` [EXTRACTED]
- [[dot-findByExternalReference()]] - `method` [EXTRACTED]
- [[dot-findById()_16]] - `method` [EXTRACTED]
- [[dot-findByIdForAdminPicking()]] - `method` [EXTRACTED]
- [[dot-findByIdForAdminStage()]] - `method` [EXTRACTED]
- [[dot-findByOrderNumber()_7]] - `method` [EXTRACTED]
- [[dot-findProductsBySkus()]] - `method` [EXTRACTED]
- [[dot-findStockCandidates()]] - `method` [EXTRACTED]
- [[dot-gateConfirmTransaction()]] - `method` [EXTRACTED]
- [[dot-list()_23]] - `method` [EXTRACTED]
- [[dot-listForExport()_2]] - `method` [EXTRACTED]
- [[dot-loadOutboundStatusSummary()]] - `method` [EXTRACTED]
- [[dot-previewOrder()]] - `references` [EXTRACTED]
- [[dot-quickDirectedOutbound()]] - `method` [EXTRACTED]
- [[dot-remove()_12]] - `method` [EXTRACTED]
- [[dot-resolveImportCompanyId()_2]] - `method` [EXTRACTED]
- [[dot-saveShippingDetails()_1]] - `method` [EXTRACTED]
- [[dot-selectShippingMethodAdmin()]] - `method` [EXTRACTED]
- [[dot-sendShippingDetails()]] - `method` [EXTRACTED]
- [[dot-supersedeUnconfirmedShipments()]] - `method` [EXTRACTED]
- [[dot-tryAllocateOnConfirm()]] - `method` [EXTRACTED]
- [[dot-updatePlan()_6]] - `method` [EXTRACTED]
- [[Injectable_153]] - `references` [EXTRACTED]
- [[client-outbound-orders.service.ts]] - `imports` [EXTRACTED]
- [[createOutboundServiceDeps()]] - `calls` [EXTRACTED]
- [[inventory-intelligence-reports.runner.ts]] - `imports` [EXTRACTED]
- [[inventory-intelligence-reports.runner.unit.spec.ts]] - `imports` [EXTRACTED]
- [[oms-orders.service.ts]] - `imports` [EXTRACTED]
- [[oms-shipping-scan.service.ts]] - `imports` [EXTRACTED]
- [[outbound-bulk.service.ts]] - `imports` [EXTRACTED]
- [[outbound-client-import.service.ts]] - `imports` [EXTRACTED]
- [[outbound-orders-csv.service.ts]] - `imports` [EXTRACTED]
- [[outbound-orders-csv.service.unit.spec.ts]] - `imports` [EXTRACTED]
- [[outbound.controller.ts]] - `imports` [EXTRACTED]
- [[outbound.module.ts]] - `imports` [EXTRACTED]
- [[outbound.service.ts]] - `contains` [EXTRACTED]
- [[reliability-test-helpers.ts]] - `imports` [EXTRACTED]
- [[reports.service.ts]] - `imports` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/withTenantRls