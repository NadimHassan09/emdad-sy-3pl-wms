---
source_file: "backend/src/modules/outbound/outbound.service.ts"
type: "code"
community: "withTenantRls"
location: "L293"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/withTenantRls
---

# .create()

## Connections
- [[dot-allocateOrder()]] - `calls` [INFERRED]
- [[dot-assertOperationalBilling()]] - `calls` [INFERRED]
- [[dot-assertSufficientStockForLines()_1]] - `calls` [EXTRACTED]
- [[dot-create()_34]] - `calls` [INFERRED]
- [[dot-create()_13]] - `calls` [INFERRED]
- [[dot-emitOutboundOrderCreated()]] - `calls` [INFERRED]
- [[dot-executeImport()]] - `calls` [INFERRED]
- [[dot-fromPrincipal()]] - `calls` [INFERRED]
- [[dot-importFileForCompany()_2]] - `calls` [INFERRED]
- [[dot-isEnabled()_3]] - `calls` [INFERRED]
- [[dot-log()]] - `calls` [INFERRED]
- [[dot-mirrorFromOutbound()]] - `calls` [INFERRED]
- [[dot-notifyAdminsPendingApproval()]] - `calls` [INFERRED]
- [[dot-record()]] - `calls` [INFERRED]
- [[dot-resolveWriteCompanyId()]] - `calls` [INFERRED]
- [[AuthPrincipal]] - `references` [EXTRACTED]
- [[CreateOutboundOrderDto]] - `references` [EXTRACTED]
- [[OmsOrderCreateExtras]] - `references` [EXTRACTED]
- [[OutboundService]] - `method` [EXTRACTED]
- [[adminOutboundListItem()]] - `calls` [EXTRACTED]
- [[assertCalendarDateNotBeforeToday()]] - `calls` [EXTRACTED]
- [[assertDiscreteUomPositiveIntegerQuantity()]] - `calls` [EXTRACTED]
- [[assertOutboundAdminPlanComplete()]] - `calls` [EXTRACTED]
- [[assertProductOrderableForOrders()]] - `calls` [EXTRACTED]
- [[assertShippingIntentReady()]] - `calls` [EXTRACTED]
- [[normalizeExecutionMode()_1]] - `calls` [EXTRACTED]
- [[omsOrderDataFromExtras()]] - `calls` [EXTRACTED]
- [[parseOutboundExecutionPlan()]] - `calls` [EXTRACTED]
- [[resolveShippingVolumeCbm()]] - `calls` [EXTRACTED]
- [[resolveShippingWeightKg()]] - `calls` [EXTRACTED]
- [[shippingPrismaData()]] - `calls` [EXTRACTED]
- [[withTenantRls()]] - `calls` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/withTenantRls